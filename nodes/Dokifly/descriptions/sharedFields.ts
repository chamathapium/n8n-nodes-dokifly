import type { IDisplayOptions, INodeProperties } from 'n8n-workflow';

export function templateLocator(
	displayOptions: IDisplayOptions,
	required = true,
): INodeProperties {
	return {
		displayName: 'Template',
		name: 'templateId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required,
		displayOptions,
		description: 'Choose a name from the list, or specify an ID using an expression',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select a template...',
				typeOptions: {
					searchListMethod: 'searchTemplates',
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. user123/tpl_abc123.html',
			},
		],
	};
}

export const pdfOptionFields: INodeProperties[] = [
	{
		displayName: 'Paper Format',
		name: 'format',
		type: 'options',
		options: [
			{ name: 'A3', value: 'A3' },
			{ name: 'A4', value: 'A4' },
			{ name: 'A5', value: 'A5' },
			{ name: 'Legal', value: 'Legal' },
			{ name: 'Letter', value: 'Letter' },
		],
		default: 'A4',
		description: 'Paper size used when rendering the PDF',
	},
	{
		displayName: 'Landscape',
		name: 'landscape',
		type: 'boolean',
		default: false,
		description: 'Whether to print the PDF in landscape orientation',
	},
	{
		displayName: 'Print Background',
		name: 'printBackground',
		type: 'boolean',
		default: true,
		description: 'Whether to include background colors and images',
	},
	{
		displayName: 'Filename',
		name: 'filename',
		type: 'string',
		default: '',
		placeholder: 'e.g. invoice.pdf',
		description: 'Filename for the generated PDF',
	},
	{
		displayName: 'Margin Top',
		name: 'marginTop',
		type: 'string',
		default: '',
		placeholder: 'e.g. 10mm',
		description: 'Top page margin. Defaults to 0mm.',
	},
	{
		displayName: 'Margin Right',
		name: 'marginRight',
		type: 'string',
		default: '',
		placeholder: 'e.g. 10mm',
		description: 'Right page margin. Defaults to 0mm.',
	},
	{
		displayName: 'Margin Bottom',
		name: 'marginBottom',
		type: 'string',
		default: '',
		placeholder: 'e.g. 10mm',
		description: 'Bottom page margin. Defaults to 0mm.',
	},
	{
		displayName: 'Margin Left',
		name: 'marginLeft',
		type: 'string',
		default: '',
		placeholder: 'e.g. 10mm',
		description: 'Left page margin. Defaults to 0mm.',
	},
	{
		displayName: 'Header Template',
		name: 'headerTemplate',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'HTML template printed in the page header',
	},
	{
		displayName: 'Footer Template',
		name: 'footerTemplate',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'HTML template printed in the page footer',
	},
];

export function pdfOptionsCollection(displayOptions: IDisplayOptions): INodeProperties {
	return {
		displayName: 'PDF Options',
		name: 'pdfOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions,
		options: pdfOptionFields,
	};
}

export function webhookAdditionalOptions(displayOptions: IDisplayOptions): INodeProperties {
	return {
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions,
		options: [
			{
				displayName: 'Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://example.com/hooks/dokifly',
				description:
					'HTTPS public URL that receives a callback when the job finishes. Pro and Growth only.',
				hint: 'Free and Starter plans receive a plan required response from the API.',
			},
		],
	};
}
