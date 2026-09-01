import type { INodeProperties } from 'n8n-workflow';
import { pdfOptionsCollection, templateLocator, webhookAdditionalOptions } from './sharedFields';

export const batchOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['batch'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a batch job',
				description: 'Queue up to 50 PDFs in one Growth-plan job',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a batch job',
				description: 'Retrieve status and item URLs for a batch job',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many batch jobs',
				description: 'List recent batch jobs',
			},
		],
		default: 'create',
	},
];

export const batchFields: INodeProperties[] = [
	{
		displayName: 'Items',
		name: 'items',
		type: 'json',
		required: true,
		default: '[]',
		displayOptions: {
			show: {
				resource: ['batch'],
				operation: ['create'],
			},
		},
		description: 'JSON array of per-row payloads. Each item may override html, URL, templateId, data, options, and filename. Maximum 50 items.',
	},
	{
		displayName: 'Default Source',
		name: 'source',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['batch'],
				operation: ['create'],
			},
		},
		options: [
			{
				name: 'None',
				value: 'none',
				description: 'Each item supplies its own HTML, URL, or template',
			},
			{
				name: 'HTML',
				value: 'html',
				description: 'Use the HTML field as the default source for items',
			},
			{
				name: 'URL',
				value: 'url',
				description: 'Use the URL field as the default source for items',
			},
			{
				name: 'Template',
				value: 'template',
				description: 'Use the Template field as the default source for items',
			},
		],
		default: 'none',
		description: 'Optional default source applied to items that do not override it',
	},
	{
		displayName: 'HTML',
		name: 'html',
		type: 'string',
		typeOptions: {
			rows: 10,
		},
		default: '',
		displayOptions: {
			show: {
				resource: ['batch'],
				operation: ['create'],
				source: ['html'],
			},
		},
		description: 'Default HTML for items that do not set their own html field',
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		default: '',
		placeholder: 'e.g. https://example.com/invoice',
		displayOptions: {
			show: {
				resource: ['batch'],
				operation: ['create'],
				source: ['url'],
			},
		},
		description: 'Default public URL for items that do not set their own URL field',
	},
	templateLocator(
		{
			show: {
				resource: ['batch'],
				operation: ['create'],
				source: ['template'],
			},
		},
		false,
	),
	{
		displayName: 'Data',
		name: 'data',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: {
				resource: ['batch'],
				operation: ['create'],
			},
		},
		description: 'Default JSON object merged into items that do not set their own data',
	},
	{
		displayName: 'Output',
		name: 'output',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['batch'],
				operation: ['create'],
			},
		},
		options: [
			{
				name: 'Download URL',
				value: 'url',
				description: 'Return CDN links that expire after 7 days',
			},
			{
				name: 'Permanent URL',
				value: 'permanent',
				description: 'Host each PDF permanently. Pro and Growth, counts against storage.',
			},
		],
		default: 'url',
		description: 'How finished PDFs are returned. Binary is not supported for batch.',
	},
	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: {
				resource: ['batch'],
				operation: ['create'],
			},
		},
		description: 'Whether to wait until the batch job finishes before continuing the workflow',
	},
	pdfOptionsCollection({
		show: {
			resource: ['batch'],
			operation: ['create'],
		},
	}),
	webhookAdditionalOptions({
		show: {
			resource: ['batch'],
			operation: ['create'],
		},
	}),
	{
		displayName: 'Job',
		name: 'jobId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: {
				resource: ['batch'],
				operation: ['get'],
			},
		},
		description: 'Choose a name from the list, or specify an ID using an expression',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select a job...',
				typeOptions: {
					searchListMethod: 'searchJobs',
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. job_abc123',
			},
		],
	},
];
