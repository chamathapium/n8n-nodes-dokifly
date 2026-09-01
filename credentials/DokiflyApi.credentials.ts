import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class DokiflyApi implements ICredentialType {
	name = 'dokiflyApi';

	displayName = 'Dokifly API';

	icon: Icon = {
		light: 'file:../nodes/Dokifly/dokifly-logo.png',
		dark: 'file:../nodes/Dokifly/dokifly-logo-dark.png',
	};

	documentationUrl = 'https://dokifly.io/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 'e.g. dk_…',
			description: 'API key from the Dokifly dashboard. Keys start with dk_.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.dokifly.io',
			placeholder: 'e.g. https://api.dokifly.io',
			description: 'API origin with no trailing slash. Leave the default unless you are testing a local server.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/pdf/usage',
			method: 'GET',
		},
	};
}
