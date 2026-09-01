import type { INodeProperties } from 'n8n-workflow';

export const templateOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['template'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a template',
				description: 'Save a new Handlebars template',
			},
		],
		default: 'create',
	},
];

export const templateFields: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Monthly Invoice',
		displayOptions: {
			show: {
				resource: ['template'],
				operation: ['create'],
			},
		},
		description: 'Template name, 1 to 120 characters',
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
				resource: ['template'],
				operation: ['create'],
			},
		},
		description: 'Handlebars HTML stored on the template',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['template'],
				operation: ['create'],
			},
		},
		description: 'Optional description, up to 500 characters',
	},
	{
		displayName: 'Data',
		name: 'data',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: {
				resource: ['template'],
				operation: ['create'],
			},
		},
		description: 'Optional JSON object stored as sample data on the template',
	},
];
