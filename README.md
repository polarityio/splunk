# Polarity Splunk Integration

Polarity's Splunk integration allows a user to connect to a Splunk instance. The integration returns the number of records that are present for a given entity.

The Splunk integration was built with the Splunk Javascript SDK. You can find more information about the SDK here: http://dev.splunk.com/javascript

## Installation of Splunk Integration

You can install an integration either through downloading the file from github, or by using git to clone the repo into your instance.


#### Download Zip File

1. Click the `Clone or Download` button
2. Select `Download Zip`
3. Upload the zip file to your Polarity-Server
4. Move the zip file to:

 `mv filename /polarity-server/integrations`
5. Once the file has been moved, navigate to integrations folder:

  `cd /polarity-server/integrations`

6. Extract the zip by running the following command:

    `unzip /splunk`

7. Navigate into the folder that was unzipped
8. Run the following command to install the integration:

  `npm install --prefix=.`

9. Restart your Polarity-Server
10. Navigate to Polarity-Web and start the integration

#### GIT Clone

1. Navigate to integrations folder:

  `cd /polarity-server/integrations`

2. Run the following git command:

  `git clone https://github.com/polarityio/integrationname`

3. Switch to the appropriate branch of the integration:

  `git checkout branch name`

4. Run the following command to install the integration:

  `npm install --prefix=.`

5. Restart your Polarity-Server
6. Navigate to Polarity-Web and start the integration


## Working with Splunk Data

Data in a Splunk instance can vary depending on what is loaded in each index. To get the most out of your Splunk instance, you will want to customize the data returned from each index that you have.


#### Working with IP Data in Splunk

To work with IP data in the Splunk integration please navigate to the lookupEntityIP function:

  `var lookupEntityIP`

The RestAPI in Splunk returns the information in two data points, fields and rows.

Those data points are extracted in the following variables

`var fields`
`var rows`

To manipulate the data from with within the lookupEntityIP function, you can work directly with those variables or you can work with the resultObjects variable that combines the two data points into one usable field.

  `var resultObjects`

Once you are done manipulating the data however you see fit, please ensure the data is getting passed to `done` for it to be passed into the IP portion of the doLookup Function.


#### Working with Hash Data in Splunk

To work with IP data in the Splunk integration please navigate to the lookupEntityHash function:

  `var lookupEntityHash`

The RestAPI in Splunk returns the information in two data points, fields and rows.

Those data points are extracted in the following variables

`var fields`
`var rows`

To manipulate the data from with within the lookupEntityHash function, you can work directly with those variables or you can work with the resultObjects variable that combines the two data points into one usable field.

  `var resultObjects`

Once you are done manipulating the data however you see fit, please ensure the data is getting passed to `done` for it to be passed into the Hash portion of the doLookup Function.


#### Working with Email Data in Splunk

To work with IP data in the Splunk integration please navigate to the lookupEntityEmail function:

  `var lookupEntityEmail`

The RestAPI in Splunk returns the information in two data points, fields and rows.

Those data points are extracted in the following variables

`var fields`
`var rows`

To manipulate the data from with within the lookupEntityEmail function, you can work directly with those variables or you can work with the resultObjects variable that combines the two data points into one usable field.

  `var resultObjects`

Once you are done manipulating the data however you see fit, please ensure the data is getting passed to `done` for it to be passed into the Email portion of the doLookup Function.


#### Working with Comma Separated Data in Splunk

There is an un-used function called `CSVImporter` within the Splunk integration that can be used to pass in the `resultObjects` variable to parse the information to make it usable.



## Splunk Settings

There are a few main settings in the Splunk Integration

#### Hostname

This setting is the hostname of your Splunk instance. Please do not include the Scheme or Port if there is one.

  `Example: www.splunkinstance.com`

#### Port

The default for port for the Splunk RestAPI is 8089. If you have changed your port when setting up your Splunk instance, please change the RestAPI port here.

  `Example: 8089`

#### Username

Username set for an individual user or if you have a generic RestAPI user, you can set it here.

  `Example: admin`

#### Password

Password set for the individual user or generic user.

#### Search String

This is the search that you will want executed within Splunk. Please ensure that your search starts with "Search" and contains {{ENTITY}} in order for the search to be executed properly.

  `Example: search index=mainIndex {{ENTITY}}`
  `
#### Scheme

Scheme set for your Splunk RestAPI. Default is set to "https", other option is http.

  `Example: https`

#### Version

Version of the Splunk instance that you are running.

  `Example: 6.5`

#### UI Hostname

This the exact hostname that you go to, in order to access the Splunk User-Interface. If there is a port or a protocal used, please ensure they are included.

  `Example: https://www.splunkinstance.com:8000`


#### Auto Cancel

This is an execution setting, that allows a user or admin to set a time limit to cancel a long running query. Time is in seconds.

  `Example: 20`