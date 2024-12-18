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
  entityTypes: ['IPv4', 'IPv6', 'MD5', 'SHA1', 'SHA256', 'email', 'domain', 'cve'],
  defaultColor: 'light-gray',
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
    proxy: ''
  },
  logging: {
    level: 'info' //trace, debug, info, warn, error, fatal
  },
  copyOnDemand: true,
  /**
   * Options that are displayed to the user/admin in the Polarity integration user-interface.  Should be structured
   * as an array of option objects.
   *
   * @type Array
   * @optional
   */
  options: [
    {
      key: 'url',
      name: 'Base Splunk URL',
      description:
        'The base URL for the Splunk REST API including the scheme (i.e., https://) and port (e.g., https://mysplunk:8089)',
      type: 'text',
      default: '',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'searchAppUrl',
      name: 'Splunk Search App URL',
      description:
        'The URL for the Splunk Search App including scheme (i.e., https://) and port (e.g., https://mysplunk:9000/en-US/app/search/search). This option must be set to "User can view only" (rather than "Only admins can view and edit").  This option should be set to "Users can view only".',
      type: 'text',
      default: '',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'username',
      name: 'Splunk Username',
      description:
        'Valid Splunk username.  Leave this field blank if authenticating via a Splunk Authentication Token.',
      type: 'text',
      default: '',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'password',
      name: 'Splunk Password',
      description:
        'Valid Splunk password corresponding to the username specified above. Leave this field blank is authenticating via a Splunk Authentication Token.',
      type: 'password',
      default: '',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'apiToken',
      name: 'Splunk Authentication Token',
      description:
        'A Splunk Authentication Token which can be created from the Splunk web interface by going to "Settings -> Tokens".',
      default: '',
      type: 'password',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'searchType',
      name: 'Search Type',
      description:
        'Select the type of search that will be run.  The "Custom SPL Search" runs a user provided SPL query and displays results. The "Index Discovery Search" runs a metasearch that will return a list of indexes where the searched entity exists. The "KV Store Search" will search the specified KV Store collection for the given entity.',
      default: {
        value: 'spl',
        display: 'Custom SPL Search'
      },
      type: 'select',
      options: [
        {
          value: 'spl',
          display:
            'Custom SPL Search -- display results from a custom SPL query -- requires options 1, 2, 3, 4, 5, and 6'
        },
        {
          value: 'searchKvStore',
          display:
            'KV Store Search -- search collections in the Splunk KV Store -- requires options 1, 4, 5, 6, 7, and 8'
        },
        {
          value: 'metaSearchTerm',
          display:
            'Index Discovery Search -- display indexes containing the searched entity -- requires options 1 and 9'
        }
      ],
      multiple: false,
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'earliestTimeBound',
      name: '1. Earliest Time Bounds',
      description:
        'Sets the earliest (inclusive) time bounds for the "Splunk Search String", "Splunk Search App Query", and "Index Discovery Search". If set, this option will override any time bounds set in the "Splunk Search String" option". Leave blank to only use time bounds set via the "Splunk Search String" option. This option should be set to "Users can view only".  Defaults to `-1mon`.',
      default: '-1mon',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'searchString',
      name: '2. Custom SPL Search - Splunk Search String',
      description:
        'Splunk Search String to execute. The string `{{ENTITY}}` will be replaced by the looked up indicator. For example: index=logs value=TERM({{ENTITY}}) | head 10.',
      default: 'index=main "{{ENTITY}}" | head 10',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'searchAppQueryString',
      name: '3. Custom SPL Search - Splunk Search App Query',
      description:
        'The query to execute when opening the Splunk Search App from the Polarity Overlay Window.  In most cases this query will be the same as the "Splunk Search String" option.  The string `{{ENTITY}}` will be replaced by the looked up indicator. For example: index=logs value=TERM({{ENTITY}}) | head 10. If left blank the "Splunk Search String" option value will be used. Defaults to empty.',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'summaryFields',
      name: '4. Custom SPL/KV Store Search - Summary Fields',
      description:
        'Comma delimited list of field values to include as part of the summary for Custom SPL and KV Store searches (no spaces between commas).  If no summary fields are specified a result count will be displayed. Summary fields must be returned by your search query.',
      default: '_si,_serial',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'includeFieldNameInSummary',
      name: '5. Custom SPL/KV Store Search - Include Field Name in Summary',
      description:
        'If checked, field names will be included as part of the summary fields. This option must be set to "User can view and edit" or "User can view only".',
      default: true,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'maxSummaryTags',
      name: '6. Custom SPL/KV Store Search - Maximum Number of Summary Tags Displayed',
      description:
        'The maximum number of summary tags to display in the Overlay Window before showing a count.  If set to 0, all tags will be shown.',
      default: 4,
      type: 'number',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'kvStoreAppsAndCollections',
      name: '7. KV Store Search - Apps & Collections to Search',
      description:
        'A comma separated list of App and Collection pairs found in the KV Store you want to run your searches on.  Each comma separated pair must use the format "<app-name>:<collection-name>".' +
        'To see a list of available collections to search, set the "Search Type" to "KV Store Search", leave this field empty and click "Apply Changes".',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'kvStoreSearchStringFields',
      name: '8. KV Store Search - Search Fields',
      description:
        'A comma separated list of KV Store Collection Fields to search on.' +
        'To see a list of available fields to search on, leave this field empty and set option 6, "KV Store Search - Apps & Collections to Search" to your desired collections, then click "Apply Changes".' +
        'Note: Minimizing these will improve search times.' +
        'Note: You can also use these fields in the "Summary Fields" option above.',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'indexDiscoveryMatchQuery',
      name: '9. Index Discovery Search - Index Discovery Match Query',
      description:
        'The query used to find matches as part of the "Index Discovery Term Search" search type. Defaults to `index=* TERM("{{ENTITY}}")`.  This value should only be changed if you need to implement custom TERM queries for your indexes or if you want to specify a set of indexes to search.',
      default: 'index=* TERM("{{ENTITY}}")',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    }
  ]
};
