import type { INodeProperties } from 'n8n-workflow';
import { pdfOptionsCollection, templateLocator, webhookAdditionalOptions } from './sharedFields';

export const pdfOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['pdf'],
			},
		},
		options: [
			{
				name: 'Generate',
				value: 'generate',
				action: 'Generate a PDF',
				description: 'Create a PDF from HTML, a URL, or a template',
			},
			{
				name: 'Get Usage',
				value: 'getUsage',
				action: 'Get PDF usage',
				description: 'Retrieve remaining monthly PDF quota',
			},
		],
		default: 'generate',
	},
];

export const pdfFields: INodeProperties[] = [
	{
		displayName: 'Source',
		name: 'source',
		type: 'options',
		noDataExpression: true,
		required: true,
		displayOptions: {
			show: {
				resource: ['pdf'],
				operation: ['generate'],
			},
		},
		options: [
			{
				name: 'HTML',
				value: 'html',
				description: 'Render HTML supplied in this node',
			},
			{
				name: 'URL',
				value: 'url',
				description: 'Render a public web page',
			},
			{
				name: 'Template',
				value: 'template',
				description: 'Render a saved Handlebars template',
			},
		],
		default: 'html',
		description: 'Where the PDF content comes from',
	},
	{
		displayName: 'HTML',
		name: 'html',
		type: 'string',
		typeOptions: {
			rows: 10,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['pdf'],
				operation: ['generate'],
				source: ['html'],
			},
		},
		description: 'HTML to convert. Handlebars {{placeholders}} work when Data is set.',
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://example.com/invoice',
		displayOptions: {
			show: {
				resource: ['pdf'],
				operation: ['generate'],
				source: ['url'],
			},
		},
		description: 'Public URL to render as a PDF',
	},
	templateLocator({
		show: {
			resource: ['pdf'],
			operation: ['generate'],
			source: ['template'],
		},
	}),
	{
		displayName: 'Data',
		name: 'data',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: {
				resource: ['pdf'],
				operation: ['generate'],
				source: ['html'],
			},
		},
		description: 'JSON object merged into Handlebars placeholders',
	},
	{
		displayName: 'Data',
		name: 'templateData',
		type: 'resourceMapper',
		noDataExpression: true,
		default: {
			mappingMode: 'defineBelow',
			value: null,
		},
		displayOptions: {
			show: {
				resource: ['pdf'],
				operation: ['generate'],
				source: ['template'],
			},
		},
		description:
			'Handlebars values loaded from the template sample JSON. Edit them here, or map from the previous item. Generate sends this object as data.',
		typeOptions: {
			loadOptionsDependsOn: ['templateId.value'],
			resourceMapper: {
				resourceMapperMethod: 'getTemplateDataFields',
				mode: 'add',
				addAllFields: true,
				supportAutoMap: true,
				hideNoDataError: true,
				fieldWords: {
					singular: 'field',
					plural: 'fields',
				},
			},
		},
	},
	{
		displayName: 'Output',
		name: 'output',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['pdf'],
				operation: ['generate'],
			},
		},
		options: [
			{
				name: 'Binary Data',
				value: 'binary',
				description: 'Attach the PDF on the item. No second download.',
			},
			{
				name: 'Download URL',
				value: 'url',
				description: 'Return a CDN link that expires after 7 days',
			},
			{
				name: 'Permanent URL',
				value: 'permanent',
				description: 'Host the PDF permanently. Pro and Growth, counts against storage.',
			},
		],
		default: 'binary',
		description: 'How the generated PDF is returned',
	},
	pdfOptionsCollection({
		show: {
			resource: ['pdf'],
			operation: ['generate'],
		},
	}),
	webhookAdditionalOptions({
		show: {
			resource: ['pdf'],
			operation: ['generate'],
		},
	}),
];
