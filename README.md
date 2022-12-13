# Polarity Splunk Integration

Polarity's Splunk integration allows a user to connect and search a Splunk Enterprise or Splunk Cloud instance with a customized search string.  Additionally, the integration supports running an "Index discovery" metasearch (see Index Discovery section below), as well as Splunk KVStore data.

| ![](images/overlay.png) |![](images/metasearch.png)
|---|---|
|*Custom Search Query* |*Index Discovery metasearch*|

## Required: Enabling Token Authentication

The Polarity-Splunk integration requires that Token Authentication be enabled on your Splunk Enterprise instance.  By default, token authentication is turned off for new installations of Splunk Enterprise. For directions on how to enable Token Authentication please see the following Splunk help page.

> https://docs.splunk.com/Documentation/Splunk/9.0.1/Security/EnableTokenAuth

To use your Splunk Cloud deployment you must submit a case requesting REST API access using the [Splunk Support Portal](https://login.splunk.com/en_us/?module=roles&func=showloginform&redirecturl=https%3A%2F%2Fwww.splunk.com%2Fpage%2Fsso_redirect%3Ftype%3Dportal%26resume%3D%2Fidp%2Fs3HZp%2FresumeSAML20%2Fidp%2FSSO.ping%26spentity%3Dhttps%3A%2F%2FPROD_SupportPortal_ExistingContact). 

> https://docs.splunk.com/Documentation/Splunk/9.0.1/RESTTUT/RESTandCloud

## Splunk Integration Options

### Base Splunk URL

The base URL for the Splunk REST API including the scheme (i.e., https://) and port (e.g., https://mysplunk:8089)  The URL for the Splunk
REST API will be different than the Splunk Web UI which defaults to port 9000.

Example REST API URL:

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

A Splunk Enterprise Authentication Token which can be created from the Splunk web interface by going to "Settings -> Tokens". If authenticating against a Splunk Cloud deployment, please leave this field blank.

### Splunk Search String

Splunk Search String to execute. The string `{{ENTITY}}` will be replaced by the looked up indicator. For example: index=logs value=TERM({{ENTITY}}) | head 10.

For example, to search the `mainIndex` you might use a query like this:

```
search index=mainIndex indicator=TERM({{ENTITY}})
```

Note the use of the `TERM` directive which is important when searching on entities such as IP addresses and provides a significant performance improvement.

For more information on the TERM directive see the Splunk documentation here: https://docs.splunk.com/Documentation/SplunkCloud/latest/Search/UseCASEandTERMtomatchphrases

#### Limit Searches by Time

As a general rule of thumb you should try to narrow down the search scope. A great way to limit the search scope is limit the time frame of data you are searching.  You can limit the time bounds of your search by using the `Earliest Time Bounds` option.  If you manually specify a time bounds using the "earliest" directive you should clear the `Earliest Time Bounds` option.  

For a list of valid time modifiers see the documentation here: https://docs.splunk.com/Documentation/SCS/current/Search/Timemodifiers

Common examples include

* `-6mon`: last 6 months
* `-1mon`: last month
* `-7d`: last 7 days
* `-4h`: last 4 hours

#### Limit Searches by Records

If your search can return more than 1 result you should always limit your query to only return a small number of events.  This can be done using the `head` parameter:

```
search source="malicious-indicators" sourcetype="csv" value=TERM({{entity}}) | head 10
```

The above search will search the `malicious-indicators` source and return events where the `value` field equals the `{{ENTITY}}` being looked up.  The search will only search the last 90 days of data and will only return the first 10 results.

#### Limit the Amount of Return Data

It is also important to limit how much data your search returns.  You can specify specific fields to include using the `fields` parameter.  For example, if you only want to return the `score`, `status`, and `value` fields you could use the following query:

```
search source="malicious-indicators" sourcetype="csv" value=TERM({{entity}}) | fields score, status, value | head 10
```

In addition to specifying which fields to return you can also tell Splunk not to return certain fields.  In particular, you can cut down on the amount of data returned by telling Splunk not to return the `_raw` field which is the entire raw event record as a string.  To tell Splunk not to return specific fields you add the `-` (minus sign), in front of the field names you do not want to return.  By default, Splunk will return the `_raw` field so it is a good idea to specifically remove it.

```
search source="malicious-indicators" sourcetype="csv" value=TERM({{entity}}) | fields score, status, value | fields - _raw | head 10
```  

There are other internal Splunk fields which all begin with an underscore (`_`).  You can remove all the internal fields from being returned by using the wildcard syntax which is an asterisk (`_*`).

```
search source="malicious-indicators" sourcetype="csv" value=TERM({{entity}})" | fields score, status, value | fields - _* | head 10
```

### Run Index Discovery Metasearch

If enabled, the integration will run a metasearch that will return a list of indexes where the searched entity exists. This search will replace your `Splunk Search String` query.

The exact query run by the integration is as follows:

```
| metasearch index=* earliest={{time-bounds}} TERM({{ENTITY}}) 
| dedup index, sourcetype    
| stats values(sourcetype) AS sourcetype by index    
| mvexpand sourcetype    
| eval index=index, sourcetype=sourcetype
| table index, sourcetype
```

For each returned index/sourcetype, the integration will provide a link that will take you to the Splunk search app with a pre-populated search for the entity in question.  The prepopulated search has the form:

```
index={{index}} sourcetype={{sourcetype}} TERM(8.8.8.8)
```

Note that the `Earliest Time Bounds` option applies to both the metasearch being run to find the indexes of interest, as well as to the


### Earliest Time Bounds

Sets the earliest (inclusive) time bounds for the "Splunk Search String" or "Index Discovery Metasearch". If set, this option will override any time bounds set in the "Splunk Search String" option". Leave blank to only use time bounds set via the "Splunk Search String" option. This option should be set to "Users can view only". Defaults to `-1mon`.

Common examples include

* `-6mon`: last 6 months
* `-1mon`: last month
* `-7d`: last 7 days
* `-4h`: last 4 hours

### Summary Fields

Comma delimited list of field values to include as part of the summary (no spaces between commas). These fields must be returned by your search query. This option must be set to "User can view and edit" or "User can view only".

 > It is important that this setting is set to "User can view only" or "User can view and edit".  This is required so the option is available to non-admin users in their Overlay Window.
 
 As an example, if our query is as follows:
 
 ```
 search source="malicious-indicators" sourcetype="csv" value=TERM({{entity}}) | fields score, status, value | head 10
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

 ## Installation Instructions

Installation instructions for integrations are provided on the [PolarityIO GitHub Page](https://polarityio.github.io/).

## Polarity

Polarity is a memory-augmentation platform that improves and accelerates analyst decision making.  For more information about the Polarity platform please see: 

https://polarity.io/
