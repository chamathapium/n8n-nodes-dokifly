import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { batchFields, batchOperations } from './descriptions/BatchDescription';
import { fileFields, fileOperations } from './descriptions/FileDescription';
import { pdfFields, pdfOperations } from './descriptions/PdfDescription';
import {
	asObjectList,
	buildPdfOptions,
	DEFAULT_PDF_FILENAME,
	dokiflyApiRequest,
	generatePdfBinary,
	getLocatorId,
	getTemplateDataFields,
	operationError,
	parseJsonArray,
	parseJsonObject,
	pollBatchJob,
	searchFiles,
	searchJobs,
	searchTemplates,
	templateDataToObject,
	toItems,
} from './GenericFunctions';

export class Dokifly implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Dokifly',
		name: 'dokifly',
		icon: { light: 'file:dokifly-logo.png', dark: 'file:dokifly-logo-dark.png' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Generate pixel-perfect PDFs from HTML, URLs, or templates',
		defaults: {
			name: 'Dokifly',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'dokiflyApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'PDF',
						value: 'pdf',
					},
					{
						name: 'File',
						value: 'file',
					},
					{
						name: 'Batch',
						value: 'batch',
					},
				],
				default: 'pdf',
			},
			...pdfOperations,
			...fileOperations,
			...batchOperations,
			...pdfFields,
			...fileFields,
			...batchFields,
		],
	};

	methods = {
		listSearch: {
			searchTemplates,
			searchFiles,
			searchJobs,
		},
		resourceMapping: {
			getTemplateDataFields,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const itemCount = items.length;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const results = await executeResource.call(
					this,
					resource,
					operation,
					itemIndex,
					itemCount,
				);
				returnData.push(...results);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error.message, {
						itemIndex,
						description: error.description ?? undefined,
					});
				}

				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, {
						itemIndex,
						message: error.message,
						description: error.description ?? undefined,
						failure: error.failure,
					});
				}

				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
			}
		}

		return [returnData];
	}
}

async function executeResource(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	itemIndex: number,
	itemCount: number,
): Promise<INodeExecutionData[]> {
	if (resource === 'pdf') {
		return await executePdf.call(this, operation, itemIndex, itemCount);
	}
	if (resource === 'file') {
		return await executeFile.call(this, operation, itemIndex, itemCount);
	}
	if (resource === 'batch') {
		return await executeBatch.call(this, operation, itemIndex, itemCount);
	}

	throw operationError(this.getNode(), `The resource ${resource} is not supported`, {
		itemIndex,
		itemCount,
	});
}

async function executePdf(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
	itemCount: number,
): Promise<INodeExecutionData[]> {
	const context = { itemIndex, itemCount };

	if (operation === 'getUsage') {
		const response = (await dokiflyApiRequest.call(
			this,
			'GET',
			'/v1/pdf/usage',
			undefined,
			undefined,
			context,
		)) as IDataObject;
		return [{ json: response, pairedItem: { item: itemIndex } }];
	}

	if (operation !== 'generate') {
		throw operationError(this.getNode(), `The operation ${operation} is not supported`, context);
	}

	const source = this.getNodeParameter('source', itemIndex) as string;
	const output = this.getNodeParameter('output', itemIndex) as string;
	const pdfOptions = this.getNodeParameter('pdfOptions', itemIndex, {}) as IDataObject;
	const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex, {}) as IDataObject;
	const filename = (pdfOptions.filename as string) || DEFAULT_PDF_FILENAME;

	const body: IDataObject = {
		output,
		options: buildPdfOptions(pdfOptions),
	};

	if (source === 'html') {
		const html = this.getNodeParameter('html', itemIndex) as string;
		if (!html) {
			throw operationError(this.getNode(), 'Enter HTML to generate a PDF', context);
		}
		body.html = html;
		const data = parseJsonObject(
			this.getNodeParameter('data', itemIndex),
			'Data',
			this.getNode(),
			context,
		);
		if (data) {
			body.data = data;
		}
	} else if (source === 'url') {
		const url = this.getNodeParameter('url', itemIndex) as string;
		if (!url) {
			throw operationError(this.getNode(), 'Enter a URL to generate a PDF', context);
		}
		body.url = url;
	} else if (source === 'template') {
		const templateId = getLocatorId.call(this, 'templateId', itemIndex);
		if (!templateId) {
			throw operationError(this.getNode(), 'Select a template to generate a PDF', context);
		}
		body.templateId = templateId;
		const data = templateDataToObject.call(this, itemIndex, context);
		if (data) {
			body.data = data;
		}
	} else {
		throw operationError(this.getNode(), 'Select HTML, URL, or Template as the source', context);
	}

	if (pdfOptions.filename) {
		body.filename = pdfOptions.filename;
	}

	if (additionalOptions.webhookUrl) {
		body.webhookUrl = additionalOptions.webhookUrl;
	}

	if (output === 'binary') {
		const item = await generatePdfBinary.call(this, body, filename, itemIndex, itemCount);
		return [item];
	}

	const response = (await dokiflyApiRequest.call(
		this,
		'POST',
		'/v1/pdf/generate',
		body,
		{ timeout: 60000 },
		context,
	)) as IDataObject;

	return [{ json: response, pairedItem: { item: itemIndex } }];
}

async function executeFile(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
	itemCount: number,
): Promise<INodeExecutionData[]> {
	const context = { itemIndex, itemCount };

	if (operation === 'getAll') {
		const response = (await dokiflyApiRequest.call(
			this,
			'GET',
			'/v1/pdf/files',
			undefined,
			undefined,
			context,
		)) as IDataObject;
		const files = asObjectList(response, ['files']);
		const storage = response.storage as IDataObject | undefined;

		if (files.length === 0) {
			return [
				{
					json: storage ? { storage } : {},
					pairedItem: { item: itemIndex },
				},
			];
		}

		return files.map((file) => ({
			json: storage ? { ...file, storage } : file,
			pairedItem: { item: itemIndex },
		}));
	}

	if (operation === 'delete') {
		const fileId = getLocatorId.call(this, 'fileId', itemIndex);
		if (!fileId) {
			throw operationError(this.getNode(), 'Select a file', context);
		}

		const response = (await dokiflyApiRequest.call(
			this,
			'DELETE',
			`/v1/pdf/files/${encodeURIComponent(fileId)}`,
			undefined,
			undefined,
			context,
		)) as IDataObject;

		return [
			{
				json: { ...response, deleted: true },
				pairedItem: { item: itemIndex },
			},
		];
	}

	throw operationError(this.getNode(), `The operation ${operation} is not supported`, context);
}

async function executeBatch(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
	itemCount: number,
): Promise<INodeExecutionData[]> {
	const context = { itemIndex, itemCount };

	if (operation === 'getAll') {
		const response = await dokiflyApiRequest.call(
			this,
			'GET',
			'/v1/pdf/batch',
			undefined,
			undefined,
			context,
		);
		return toItems(asObjectList(response, ['jobs', 'batchJobs']), itemIndex);
	}

	if (operation === 'get') {
		const jobId = getLocatorId.call(this, 'jobId', itemIndex);
		if (!jobId) {
			throw operationError(this.getNode(), 'Select a batch job', context);
		}

		const response = (await dokiflyApiRequest.call(
			this,
			'GET',
			`/v1/pdf/batch/${encodeURIComponent(jobId)}`,
			undefined,
			undefined,
			context,
		)) as IDataObject;
		return [{ json: response, pairedItem: { item: itemIndex } }];
	}

	if (operation !== 'create') {
		throw operationError(this.getNode(), `The operation ${operation} is not supported`, context);
	}

	const items = parseJsonArray(
		this.getNodeParameter('items', itemIndex),
		'Items',
		this.getNode(),
		context,
	);
	const source = this.getNodeParameter('source', itemIndex) as string;
	const output = this.getNodeParameter('output', itemIndex) as string;
	const waitForCompletion = this.getNodeParameter('waitForCompletion', itemIndex) as boolean;
	const pdfOptions = this.getNodeParameter('pdfOptions', itemIndex, {}) as IDataObject;
	const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex, {}) as IDataObject;

	const body: IDataObject = {
		items,
		output,
		options: buildPdfOptions(pdfOptions),
	};

	if (source === 'html') {
		const html = this.getNodeParameter('html', itemIndex) as string;
		if (html) {
			body.html = html;
		}
	} else if (source === 'url') {
		const url = this.getNodeParameter('url', itemIndex) as string;
		if (url) {
			body.url = url;
		}
	} else if (source === 'template') {
		const templateId = getLocatorId.call(this, 'templateId', itemIndex);
		if (templateId) {
			body.templateId = templateId;
		}
	}

	const data = parseJsonObject(
		this.getNodeParameter('data', itemIndex),
		'Data',
		this.getNode(),
		context,
	);
	if (data) {
		body.data = data;
	}

	if (additionalOptions.webhookUrl) {
		body.webhookUrl = additionalOptions.webhookUrl;
	}

	const created = (await dokiflyApiRequest.call(
		this,
		'POST',
		'/v1/pdf/batch',
		body,
		undefined,
		context,
	)) as IDataObject;

	if (!waitForCompletion) {
		return [{ json: created, pairedItem: { item: itemIndex } }];
	}

	const jobId = created.jobId as string;
	if (!jobId) {
		return [{ json: created, pairedItem: { item: itemIndex } }];
	}

	const job = await pollBatchJob.call(this, jobId, itemIndex, itemCount);
	return [{ json: job, pairedItem: { item: itemIndex } }];
}
