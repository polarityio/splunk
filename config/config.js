module.exports = {
  /**
   * Name of the integration which is displayed in the Polarity integrations user interface
   *
   * @type String
   * @required
   */
  name: 'Splunk',
  /**
   * The acronym that appears in the notification window when information from this integration
   * is displayed.  Note that the acronym is included as part of each "tag" in the summary information
   * for the integration.  As a result, it is best to keep it to 4 or less characters.  The casing used
   * here will be carried forward into the notification window.
   *
   * @type String
   * @required
   */
  acronym: 'SPLNK',
  /**
   * Description for this integration which is displayed in the Polarity integrations user interface
   *
   * @type String
   * @optional
   */
  description:
    'Splunk allows you to aggregate, analyze and get answers from your machine data with the help of machine learning and real-time visibility.',
  entityTypes: ['IPv4', 'IPv6', 'hash', 'email', 'domain'],
  /**
   * An array of style files (css or less) that will be included for your integration. Any styles specified in
   * the below files can be used in your custom template.
   *
   * @type Array
   * @optional
   */
  styles: ['./styles/se.less'],
  /**
   * Provide custom component logic and template for rendering the integration details block.  If you do not
   * provide a custom template and/or component then the integration will display data as a table of key value
   * pairs.
   *
   * @type Object
   * @optional
   */
  block: {
    component: {
      file: './components/se-block.js'
    },
    template: {
      file: './templates/se-block.hbs'
    }
  },
  summary: {
    component: {
      file: './components/se-summary.js'
    },
    template: {
      file: './templates/se-summary.hbs'
    }
  },
  request: {
    // Provide the path to your certFile. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    cert: '',
    // Provide the path to your private key. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    key: '',
    // Provide the key passphrase if required.  Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    passphrase: '',
    // Provide the Certificate Authority. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    ca: '',
    // An HTTP proxy to be used. Supports proxy Auth with Basic Auth, identical to support for
    // the url parameter (by embedding the auth info in the uri)
    proxy: '',

    rejectUnauthorized: true
  },
  logging: {
    level: 'info' //trace, debug, info, warn, error, fatal
  },
  /**
   * Options that are displayed to the user/admin in the Polarity integration user-interface.  Should be structured
   * as an array of option objects.
   *
   * @type Array
   * @optional
   */
  options: [
    {
      key: 'isCloud',
      name: 'Splunk Cloud Deployment',
      description:
        'If checked, the integration will leverage the username/password specified below for authentication to a Splunk Cloud deployment.  If left unchecked, the integration will leverage the API Token specfied below to connect to a Splunk Enterprise deployment. (Please set this to admin only and user can view only.)',
      default: false,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'url',
      name: 'Base Splunk URL',
      description:
        'The base URL for the Splunk REST API including the schema (i.e., https://) and port (e.g., https://mysplunk:8089)',
      type: 'text',
      default: '',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'searchAppUrl',
      name: 'Splunk Search App URL',
      description:
        'The URL for the Splunk Search App including schema (i.e., https://) and port (e.g., https://mysplunk:9000/en-US/app/search/search). This option must be set to "User can view only" (rather than "Only admins can view and edit").',
      type: 'text',
      default: '',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'username',
      name: 'Splunk Cloud Username',
      description:
        'Valid Splunk Cloud username.  If authenticating against a Splunk Enterprise deployment, please leave this field blank.',
      type: 'text',
      default: '',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'password',
      name: 'Splunk Cloud Password',
      description:
        'Valid Splunk Cloud password corresponding to the username specified above.  If authenticating against a Splunk Enterprise deployment, please leave this field blank.',
      type: 'password',
      default: '',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'apiToken',
      name: 'Splunk Authentication Token',
      description:
        'A Splunk Enterprise Authentication Token which can be created from the Splunk web interface by going to "Settings -> Tokens".  If authenticating against a Splunk Cloud deployment, please leave this field blank.',
      default: '',
      type: 'password',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'searchString',
      name: 'Splunk Search String',
      description:
        'Splunk Search String to execute. The string `{{ENTITY}}` will be replace by the looked up indicator. For example: index=logs value={{ENTITY}} | head 10',
      default: '{{ENTITY}} | head 10',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },

    {
      key: 'summaryFields',
      name: 'Summary Fields',
      description:
        'Comma delimited list of field values to include as part of the summary (no spaces between commas).  These fields must be returned by your search query. This option must be set to "User can view and edit" or "User can view only".',
      default: '_si,_serial',
      type: 'text',
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'includeFieldNameInSummary',
      name: 'Include Field Name in Summary',
      description:
        'If checked, field names will be included as part of the summary fields. This option must be set to "User can view and edit" or "User can view only".',
      default: true,
      type: 'boolean',
      userCanEdit: true,
      adminOnly: false
    }
  ]
};
