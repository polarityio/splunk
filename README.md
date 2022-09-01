# Polarity Splunk Integration

Polarity's Splunk integration allows a user to connect and search a Splunk instance. 

![image](images/overlay.png)

The Splunk integration was built with the Splunk Javascript SDK. You can find more information about the SDK here: http://dev.splunk.com/javascript

## Required: Enabling Token Authentication

The Polarity-Splunk integration requires that Token Authentication be enabled on your Splunk Enterprise instance.  By default, token authentication is turned off for new installations of Splunk Enterprise. For directions on how to enable Token Authentication please see the following Splunk help page.

> https://docs.splunk.com/Documentation/Splunk/7.3.1/Security/EnableTokenAuth 

To use your Splunk Cloud deployment you must submit a case requesting access using the [Splunk Support Portal](https://login.splunk.com/en_us/?module=roles&func=showloginform&redirecturl=https%3A%2F%2Fwww.splunk.com%2Fpage%2Fsso_redirect%3Ftype%3Dportal%26resume%3D%2Fidp%2Fs3HZp%2FresumeSAML20%2Fidp%2FSSO.ping%26spentity%3Dhttps%3A%2F%2FPROD_SupportPortal_ExistingContact). 

> https://docs.splunk.com/Documentation/Splunk/8.0.6/RESTTUT/RESTandCloud

Splunk Cloud authentication currently uses basic authentication via a username and password.

## SPL Queries

The Splunk integration allows users to directly query Splunk using SPL queries.  To enable this feature, please uncomment the custom `splunkSearch` entity type from this integration's `config.js` file found in the `config/config.js` folder.  If the custom `splunkSearch` entity type is enabled, please ensure the integration is set to run in `onDemand Only` mode.

## Splunk Integration Options

### Splunk Cloud Deployment

If checked, the integration will leverage the username/password specified below for authentication to a Splunk Cloud deployment.  If left unchecked, the integration will leverage the API Token specfied below to connect to a Splunk Enterprise deployment. (Please set this to admin only and user can view only.)

### Base Splunk URL

The base URL for the Splunk REST API including the schema (i.e., https://) and port (e.g., https://mysplunk:8089).  The URL for the Splunk
REST API will be different than the Splunk Web UI which defaults to port 9000.

Example REST API Url:

```
https://splunk.dev:8089
```

> The default port for the Splunk REST API is 8089.

### Splunk Search App URL

The URL for the Splunk Search App including schema (i.e., https://) and port (e.g., https://mysplunk:9000/en-US/app/search/search). This option must be set to "User can view only" (rather than "Only admins can view and edit").  This setting is used to make a clickable link in the Overlay Window that will take you to the Splunk search interface.

> It is important that this setting is set to "User can view only".  This is required so the option is available to non-admin users in their Overlay Window.


### Splunk Cloud Username

Valid Splunk Cloud username.  If authenticating against a Splunk Enterprise deployment, please leave this field blank.

### Splunk Cloud Password

Valid Splunk Cloud password corresponding to the username specified above.  If authenticating against a Splunk Enterprise deployment, please leave this field blank.


### Splunk Authentication Token

A Splunk Authentication Token which can be created from the Splunk web interface by going to "Settings -> Tokens". 

### Splunk Search String

This is the search that you want executed within Splunk. Please ensure that your search starts with "search" and contains the variable `{{ENTITY}}` in order for the search to be executed properly.  The variable represented by the string `{{ENTITY}}` will be replaced by the actual entity (i.e., an IP, hash, or email) that Polarity recognized on the user's screen.

For example, to search the `mainIndex` you might use a query like this:

```
search index=mainIndex indicator="{{ENTITY}}"
```

#### Limit Searches by Time

As a general rule of thumb you should try to narrow down the search scope. A great way to limit the search scope is limit the time frame of data you are searching.  For example, to only search the last 90 days of data you could use the following:

```
search source="malicious-indicators" sourcetype="csv" earliest=-90d value="{{entity}}" 
```

#### Limit Searches by Records

If your search can return more than 1 result you should always limit your query to only return a small number of events.  This can be done using the `head` parameter:

```
search source="malicious-indicators" sourcetype="csv" value="{{entity}}" earliest=-90d | head 10
```

The above search will search the `malicious-indicators` source and return events where the `value` field equals the `{{ENTITY}}` being looked up.  The search will only search the last 90 days of data and will only return the first 10 results.

#### Limit the Amount of Return Data

It is also important to limit how much data your search returns.  You can specify specific fields to include using the `fields` parameter.  For example, if you only want to return the `score`, `status`, and `value` fields you could use the following query:

```
search source="malicious-indicators" sourcetype="csv" earliest=-90d value="{{entity}}" | fields score, status, value | head 10
```

In addition to specifying which fields to return you can also tell Splunk not to return certain fields.  In particular, you can cut down on the amount of data returned by telling Splunk not to return the `_raw` field which is the entire raw event record as a string.  To tell Splunk not to return specific fields you add the `-` (minus sign), in front of the field names you do not want to return.  By default, Splunk will return the `_raw` field so it is a good idea to specifically remove it.

```
search source="malicious-indicators" sourcetype="csv" earliest=-90d value="{{entity}}" | fields score, status, value | fields - _raw | head 10
```  

There are other internal Splunk fields which all begin with an underscore (`_`).  You can remove all the internal fields from being returned by using the wildcard syntax which is an asterisk (`_*`).

```
search source="malicious-indicators" sourcetype="csv" value="{{entity}}" earliest=-90d | fields score, status, value | fields - _* | head 10
```

### Summary Fields

Comma delimited list of field values to include as part of the summary (no spaces between commas). These fields must be returned by your search query. This option must be set to "User can view and edit" or "User can view only".

 > It is important that this setting is set to "User can view only" or "User can view and edit".  This is required so the option is available to non-admin users in their Overlay Window.
 
 As an example, if our query is as follows:
 
 ```
 search source="malicious-indicators" sourcetype="csv" value="{{entity}}" earliest=-90d | fields score, status, value | fields - _* | head 10
 ```
 
 We could show just the score and status in the summary view by setting the "Summary Fields" option to:
 
 ```
 score,status
 ```
 

### Search KV Store
If checked, the KV Store will be searched using the parameters below, which will replace and disable your Standard Splunk Search above.

### KV Store Apps & Collections to Search
A comma separated list of App and Collection pairs found in the KV Store you want to run your searches on.  Each comma separated pair must use the format `<app-name>:<collection-name>`
To see a list of available collections to search, leave this field empty, check the "Search KV Store" option above, and click "Apply Changes".

### KV Store Search Fields
A comma separated list of KV Store Collection Fields to search on. To see a list of available fields to search on, leave this field empty, check the "Search KV Store" option above, and set "KV Store Apps & Collections to Search" to your desired collections, then click "Apply Changes".
> ***Note:*** Minimizing these will improve KV Store search times.
> ***Note:*** You can also use these fields in the "Summary Fields" option above.


### Earliest SPL Time Bounds

Sets the earliest (inclusive) time bounds for the search when directly searching using a Splunk SPL query. This option only applies to SPL queries directly input by the user and does not limit the results returned by the `Splunk Search String` option. This option should be set to "Users can view only". Defaults to `-1mon`.

### Maximum SPL Results

The maximum number of results to return when directly searching using a Splunk SPL query. This option only applies to SPL queries directly input by the user and does not limit the results returned by the `Splunk Search String` option. This option should be set to "Users can view only". Defaults to 10.

 ## Installation Instructions

Installation instructions for integrations are provided on the [PolarityIO GitHub Page](https://polarityio.github.io/).

## Polarity

Polarity is a memory-augmentation platform that improves and accelerates analyst decision making.  For more information about the Polarity platform please see: 

https://polarity.io/
