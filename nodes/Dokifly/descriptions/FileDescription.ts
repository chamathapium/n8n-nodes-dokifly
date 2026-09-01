import type { INodeProperties } from 'n8n-workflow';

export const fileOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['file'],
			},
		},
		options: [
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a file',
				description: 'Remove a permanently hosted PDF',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many files',
				description: 'List permanently hosted PDFs',
			},
		],
		default: 'getAll',
	},
];

export const fileFields: INodeProperties[] = [
	{
		displayName: 'File',
		name: 'fileId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['delete'],
			},
		},
		description: 'Choose a name from the list, or specify an ID using an expression',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select a file...',
				typeOptions: {
					searchListMethod: 'searchFiles',
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. file_abc123',
			},
		],
	},
];
