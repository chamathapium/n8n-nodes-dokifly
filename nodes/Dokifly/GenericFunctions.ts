import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INode,
	INodeExecutionData,
	INodeListSearchResult,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';

export const CREDENTIAL_TYPE = 'dokiflyApi';
export const DEFAULT_BASE_URL = 'https://api.dokifly.io';
export const DEFAULT_PDF_FILENAME = 'dokifly-output.pdf';
export const MAX_BATCH_ITEMS = 50;
export const BATCH_POLL_INTERVAL_MS = 2000;
export const BATCH_POLL_TIMEOUT_MS = 10 * 60 * 1000;

type DokiflyContext = IExecuteFunctions | ILoadOptionsFunctions;

export interface ItemContext {
	itemIndex?: number;
	itemCount?: number;
}

function itemSuffix(context?: ItemContext): string {
	if (
		context?.itemCount !== undefined &&
		context.itemCount > 1 &&
		context.itemIndex !== undefined
	) {
		return ` [item ${context.itemIndex}]`;
	}
	return '';
}

export function stripEmpty(value: IDataObject): IDataObject {
	const result: IDataObject = {};

	for (const [key, entry] of Object.entries(value)) {
		if (entry === undefined || entry === null || entry === '') {
			continue;
		}

		if (Array.isArray(entry)) {
			result[key] = entry;
			continue;
		}

		if (typeof entry === 'object' && !(entry instanceof Buffer)) {
			const nested = stripEmpty(entry as IDataObject);
			if (Object.keys(nested).length > 0) {
				result[key] = nested;
			}
			continue;
		}

		result[key] = entry;
	}

	return result;
}

function toJsonObject(error: unknown): JsonObject {
	if (error && typeof error === 'object') {
		return error as JsonObject;
	}

	return { message: String(error) };
}

function parseMaybeJson(value: unknown): IDataObject | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}

	if (Buffer.isBuffer(value)) {
		try {
			return JSON.parse(value.toString('utf8')) as IDataObject;
		} catch {
			return undefined;
		}
	}

	if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
		try {
			return JSON.parse(Buffer.from(value).toString('utf8')) as IDataObject;
		} catch {
			return undefined;
		}
	}

	if (typeof value === 'string') {
		try {
			return JSON.parse(value) as IDataObject;
		} catch {
			return { message: value };
		}
	}

	if (typeof value === 'object') {
		return value as IDataObject;
	}

	return undefined;
}

function extractApiPayload(error: unknown): {
	httpCode?: string;
	apiError?: string;
	message?: string;
	upgrade?: string;
	body?: IDataObject;
} {
	const err = error as {
		httpCode?: string | number;
		statusCode?: number;
		status?: number;
		message?: string;
		description?: string;
		error?: unknown;
		cause?: {
			response?: { data?: unknown; status?: number };
			status?: number;
		};
		response?: { data?: unknown; status?: number; body?: unknown };
	};

	const httpCodeRaw =
		err.httpCode ??
		err.statusCode ??
		err.status ??
		err.cause?.response?.status ??
		err.cause?.status ??
		err.response?.status;

	const body =
		parseMaybeJson(err.cause?.response?.data) ??
		parseMaybeJson(err.response?.data) ??
		parseMaybeJson(err.response?.body) ??
		parseMaybeJson(err.error);

	const apiError = typeof body?.error === 'string' ? body.error : undefined;
	const message =
		(typeof body?.message === 'string' ? body.message : undefined) || err.message;
	const upgrade = typeof body?.upgrade === 'string' ? body.upgrade : undefined;

	return {
		httpCode: httpCodeRaw !== undefined && httpCodeRaw !== null ? String(httpCodeRaw) : undefined,
		apiError,
		message,
		upgrade,
		body,
	};
}

export function dokiflyApiError(node: INode, error: unknown, context?: ItemContext): NodeApiError {
	const payload = extractApiPayload(error);
	const suffix = itemSuffix(context);
	const httpCode = payload.httpCode;
	const apiError = payload.apiError;
	const raw = toJsonObject(error);
	const optionsBase = {
		itemIndex: context?.itemIndex,
		httpCode,
	};

	if (httpCode === '401' || apiError === 'missing_api_key' || apiError === 'invalid_api_key') {
		return new NodeApiError(node, raw, {
			...optionsBase,
			message: `Authentication failed. Check the API key in credentials.${suffix}`,
			description: 'Create a new key at https://dokifly.io/dashboard/keys and paste it into the Dokifly API credential.',
			failure: { cause: 'credential-invalid' },
		});
	}

	if (httpCode === '403' && apiError === 'plan_required') {
		return new NodeApiError(node, raw, {
			...optionsBase,
			message: `${payload.message ?? 'This operation is not included in the current plan.'}${suffix}`,
			description: `Upgrade at ${payload.upgrade ?? 'https://dokifly.io/pricing'}`,
			failure: { cause: 'configuration-invalid' },
		});
	}

	if (httpCode === '404' || apiError === 'not_found') {
		return new NodeApiError(node, raw, {
			...optionsBase,
			message: `Template, file, or job could not be found. Check the ID.${suffix}`,
			description: 'Open Get Many to confirm the ID, then try again.',
			failure: { cause: 'configuration-invalid' },
		});
	}

	if (httpCode === '429' && apiError === 'quota_exceeded') {
		return new NodeApiError(node, raw, {
			...optionsBase,
			message: `Monthly PDF quota used up.${suffix}`,
			description: 'Wait for the quota to reset, or upgrade at https://dokifly.io/pricing',
			failure: { cause: 'quota-exhausted' },
		});
	}

	if (httpCode === '429' && apiError === 'storage_quota_exceeded') {
		return new NodeApiError(node, raw, {
			...optionsBase,
			message: `Permanent storage cap reached.${suffix}`,
			description: 'Delete unused files or upgrade at https://dokifly.io/pricing',
			failure: { cause: 'quota-exhausted' },
		});
	}

	if (httpCode === '429') {
		return new NodeApiError(node, raw, {
			...optionsBase,
			message: `Too many requests. Wait and retry.${suffix}`,
			description: 'Dokifly allows 60 requests per minute per API key.',
			failure: { cause: 'rate-limited' },
		});
	}

	if (
		httpCode === '400' &&
		(apiError === 'invalid_webhook_url' ||
			apiError === 'invalid_output' ||
			apiError === 'conflicting_input' ||
			apiError === 'missing_input')
	) {
		return new NodeApiError(node, raw, {
			...optionsBase,
			message: `${payload.message ?? 'The request could not be processed.'}${suffix}`,
		});
	}

	if (httpCode === '413' || apiError === 'html_too_large') {
		return new NodeApiError(node, raw, {
			...optionsBase,
			message: `HTML is over 5 MB.${suffix}`,
			description: 'Reduce the HTML size or generate from a URL instead.',
		});
	}

	if (httpCode === '504' || apiError === 'render_timeout') {
		return new NodeApiError(node, raw, {
			...optionsBase,
			message: `Rendering took more than 15 seconds. Simplify the HTML or use a URL.${suffix}`,
			failure: { cause: 'temporarily-unavailable' },
		});
	}

	if (httpCode === '500' && apiError === 'generation_failed') {
		return new NodeApiError(node, raw, {
			...optionsBase,
			message: `The PDF could not be generated. Retry.${suffix}`,
		});
	}

	if (payload.message) {
		return new NodeApiError(node, raw, {
			...optionsBase,
			message: `${payload.message}${suffix}`,
		});
	}

	return new NodeApiError(node, raw, optionsBase);
}

export function operationError(
	node: INode,
	message: string,
	context: ItemContext,
	description?: string,
): NodeOperationError {
	return new NodeOperationError(node, `${message}${itemSuffix(context)}`, {
		itemIndex: context.itemIndex,
		description,
	});
}

async function waitOrCancel(ms: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) {
		throw new Error('cancelled');
	}

	await sleep(ms);

	if (signal?.aborted) {
		throw new Error('cancelled');
	}
}

export async function dokiflyApiRequest(
	this: DokiflyContext,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	option: Partial<IHttpRequestOptions> = {},
	context?: ItemContext,
): Promise<unknown> {
	const credentials = await this.getCredentials(CREDENTIAL_TYPE);
	const baseUrl = String(credentials.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		headers: {
			Accept: 'application/json',
		},
		json: true,
		...option,
	};

	if (body && Object.keys(body).length > 0) {
		options.body = stripEmpty(body);
		options.headers = {
			...options.headers,
			'Content-Type': 'application/json',
		};
	}

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIAL_TYPE, options);
	} catch (error) {
		throw dokiflyApiError(this.getNode(), error, context);
	}
}

export function parseJsonObject(
	value: unknown,
	fieldLabel: string,
	node: INode,
	context: ItemContext,
): IDataObject | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}

	let parsed: unknown = value;

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed || trimmed === '{}') {
			return undefined;
		}

		try {
			parsed = JSON.parse(trimmed) as unknown;
		} catch {
			throw operationError(
				node,
				`The '${fieldLabel}' value must be valid JSON`,
				context,
				'Enter a JSON object, for example {"invoiceNumber": "INV-001"}.',
			);
		}
	}

	if (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null) {
		throw operationError(
			node,
			`The '${fieldLabel}' value must be a JSON object`,
			context,
			'Arrays and primitive values are not sent as Handlebars data.',
		);
	}

	const objectValue = parsed as IDataObject;
	if (Object.keys(objectValue).length === 0) {
		return undefined;
	}

	return objectValue;
}

export function parseJsonArray(
	value: unknown,
	fieldLabel: string,
	node: INode,
	context: ItemContext,
): IDataObject[] {
	let parsed: unknown = value;

	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value) as unknown;
		} catch {
			throw operationError(
				node,
				`The '${fieldLabel}' value must be valid JSON`,
				context,
				'Enter a JSON array of objects.',
			);
		}
	}

	if (!Array.isArray(parsed)) {
		throw operationError(
			node,
			`The '${fieldLabel}' value must be a JSON array of objects`,
			context,
		);
	}

	if (parsed.length === 0) {
		throw operationError(node, `Enter at least one item in '${fieldLabel}'`, context);
	}

	if (parsed.length > MAX_BATCH_ITEMS) {
		throw operationError(
			node,
			`The '${fieldLabel}' array can contain at most ${MAX_BATCH_ITEMS} entries`,
			context,
			'Split the work into multiple batch jobs.',
		);
	}

	for (const [index, entry] of parsed.entries()) {
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
			throw operationError(
				node,
				`Each entry in '${fieldLabel}' must be a JSON object`,
				context,
				`Check item ${index} in the array.`,
			);
		}
	}

	return parsed as IDataObject[];
}

export function getLocatorId(
	this: IExecuteFunctions,
	parameterName: string,
	itemIndex: number,
): string {
	return this.getNodeParameter(parameterName, itemIndex, '', {
		extractValue: true,
	}) as string;
}

export function buildPdfOptions(pdfOptions: IDataObject): IDataObject {
	const options: IDataObject = {
		format: (pdfOptions.format as string) || 'A4',
		landscape: pdfOptions.landscape ?? false,
		printBackground: pdfOptions.printBackground ?? true,
		margin: {
			top: (pdfOptions.marginTop as string) || '0mm',
			right: (pdfOptions.marginRight as string) || '0mm',
			bottom: (pdfOptions.marginBottom as string) || '0mm',
			left: (pdfOptions.marginLeft as string) || '0mm',
		},
	};

	if (pdfOptions.headerTemplate) {
		options.headerTemplate = pdfOptions.headerTemplate;
	}

	if (pdfOptions.footerTemplate) {
		options.footerTemplate = pdfOptions.footerTemplate;
	}

	return options;
}

function headerMap(headers: IDataObject): Record<string, unknown> {
	const mapped: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(headers ?? {})) {
		mapped[key.toLowerCase()] = value;
	}
	return mapped;
}

export async function preparePdfItem(
	this: IExecuteFunctions,
	body: Buffer,
	filename: string,
	headers: IDataObject,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const binaryData = await this.helpers.prepareBinaryData(body, filename, 'application/pdf');
	const json: IDataObject = { success: true };
	const headersNormalized = headerMap(headers);
	const usageHeaders: Array<[string, string]> = [
		['limit', 'x-dokifly-limit'],
		['used', 'x-dokifly-used'],
		['remaining', 'x-dokifly-remaining'],
		['renderTimeMs', 'x-dokifly-render-time'],
	];

	for (const [jsonKey, headerName] of usageHeaders) {
		const raw = headersNormalized[headerName];
		if (raw === undefined || raw === null || raw === '') {
			continue;
		}
		const numeric = Number(raw);
		json[jsonKey] = Number.isNaN(numeric) ? raw : numeric;
	}

	return {
		json,
		binary: { data: binaryData },
		pairedItem: { item: itemIndex },
	};
}

export function toItems(data: IDataObject[], itemIndex: number): INodeExecutionData[] {
	return data.map((json) => ({
		json,
		pairedItem: { item: itemIndex },
	}));
}

export function asObjectList(response: unknown, keys: string[]): IDataObject[] {
	if (Array.isArray(response)) {
		return response as IDataObject[];
	}

	if (response && typeof response === 'object') {
		const record = response as IDataObject;
		for (const key of keys) {
			if (Array.isArray(record[key])) {
				return record[key] as IDataObject[];
			}
		}
	}

	return [];
}

export async function generatePdfBinary(
	this: IExecuteFunctions,
	body: IDataObject,
	filename: string,
	itemIndex: number,
	itemCount: number,
): Promise<INodeExecutionData> {
	const credentials = await this.getCredentials(CREDENTIAL_TYPE);
	const baseUrl = String(credentials.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
	const context: ItemContext = { itemIndex, itemCount };

	const options: IHttpRequestOptions = {
		method: 'POST',
		url: `${baseUrl}/v1/pdf/generate`,
		headers: {
			Accept: 'application/pdf, application/json',
			'Content-Type': 'application/json',
		},
		body: stripEmpty(body),
		encoding: 'arraybuffer',
		returnFullResponse: true,
		json: false,
		timeout: 60000,
	};

	let response: { body?: unknown; headers?: IDataObject };
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			CREDENTIAL_TYPE,
			options,
		)) as { body?: unknown; headers?: IDataObject };
	} catch (error) {
		throw dokiflyApiError(this.getNode(), error, context);
	}

	const rawBody = response.body;
	let buffer: Buffer;
	if (Buffer.isBuffer(rawBody)) {
		buffer = rawBody;
	} else if (rawBody instanceof ArrayBuffer) {
		buffer = Buffer.from(new Uint8Array(rawBody));
	} else if (rawBody instanceof Uint8Array) {
		buffer = Buffer.from(rawBody);
	} else if (typeof rawBody === 'string') {
		buffer = Buffer.from(rawBody);
	} else {
		buffer = Buffer.alloc(0);
	}

	return await preparePdfItem.call(this, buffer, filename, response.headers ?? {}, itemIndex);
}

export async function pollBatchJob(
	this: IExecuteFunctions,
	jobId: string,
	itemIndex: number,
	itemCount: number,
): Promise<IDataObject> {
	const context: ItemContext = { itemIndex, itemCount };
	const signal = this.getExecutionCancelSignal?.();
	const started = Date.now();
	const path = `/v1/pdf/batch/${encodeURIComponent(jobId)}`;

	while (true) {
		if (signal?.aborted) {
			throw operationError(this.getNode(), 'The execution was cancelled', context);
		}

		const job = (await dokiflyApiRequest.call(
			this,
			'GET',
			path,
			undefined,
			undefined,
			context,
		)) as IDataObject;
		const status = job.status as string;

		if (status === 'completed' || status === 'partial') {
			return job;
		}

		if (status === 'failed') {
			const message =
				(typeof job.message === 'string' && job.message) ||
				(typeof job.error === 'string' && job.error) ||
				'The batch job did not complete';
			throw new NodeApiError(this.getNode(), job as JsonObject, {
				message: `${message}${itemSuffix(context)}`,
				itemIndex,
			});
		}

		if (Date.now() - started >= BATCH_POLL_TIMEOUT_MS) {
			throw operationError(
				this.getNode(),
				`The batch job is still processing. Use Get a batch job with this jobId: ${jobId}`,
				context,
			);
		}

		try {
			await waitOrCancel(BATCH_POLL_INTERVAL_MS, signal);
		} catch {
			throw operationError(this.getNode(), 'The execution was cancelled', context);
		}
	}
}

function filterResults(
	results: Array<{ name: string; value: string }>,
	filter?: string,
): Array<{ name: string; value: string }> {
	const query = (filter ?? '').trim().toLowerCase();
	if (!query) {
		return results;
	}

	return results.filter(
		(item) =>
			item.name.toLowerCase().includes(query) || String(item.value).toLowerCase().includes(query),
	);
}

export async function searchTemplates(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await dokiflyApiRequest.call(this, 'GET', '/v1/templates');
	const templates = asObjectList(response, ['templates']);

	return {
		results: filterResults(
			templates.map((template) => ({
				name: String(template.name || template.templateId || 'Template'),
				value: String(template.templateId ?? ''),
			})),
			filter,
		),
	};
}

export async function searchFiles(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await dokiflyApiRequest.call(this, 'GET', '/v1/pdf/files');
	const files = asObjectList(response, ['files']);

	return {
		results: filterResults(
			files.map((file) => ({
				name: String(file.filename || file.fileId || 'File'),
				value: String(file.fileId ?? ''),
			})),
			filter,
		),
	};
}

export async function searchJobs(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await dokiflyApiRequest.call(this, 'GET', '/v1/pdf/batch');
	const jobs = asObjectList(response, ['jobs', 'batchJobs']);

	return {
		results: filterResults(
			jobs.map((job) => ({
				name: String(job.jobId || 'Job'),
				value: String(job.jobId ?? ''),
			})),
			filter,
		),
	};
}
