# Polarity Splunk Integration

**This integration is still in development**

Polarity's Splunk integration allows a user to connect to a Splunk instance. The integration returns the number of records that are present for a given entity.

The Splunk integration was built with the Splunk Javascript SDK. You can find more information about the SDK here: http://dev.splunk.com/javascript

## Splunk Integration Options

### Hostname

This setting is the hostname of your Splunk instance. Please do not include the Scheme or Port if there is one. For example:

```
www.splunkinstance.com
```

### Port

The default for port for the Splunk RestAPI is 8089. If you have changed your port when setting up your Splunk instance, please change the RestAPI port here.

### Username

Username set for an individual user or if you have a generic RestAPI user, you can set it here. 

### Password

Password set for the individual user or generic user.

### Search String

This is the search that you want executed within Splunk. Please ensure that your search starts with "search" and contains the variable `{{ENTITY}}` in order for the search to be executed properly.  The variable represented by the string `{{ENTITY}}` will be replaced by the actual entity (i.e., an IP, hash, or email) that Polarity recognized on the user's screen.

For example, to search the `mainIndex` you might use a query like this:

```
search index=mainIndex {{ENTITY}}
```
    
### Scheme

Scheme set for your Splunk RestAPI. Valid values are `https` and `http`.  The default value is set to `https`.
  
### Version

Version of the Splunk instance that you are running.  For example, `6.5`.

### UI Hostname

This the exact hostname that you go to in order to access the Splunk User-Interface. If there is a port or a protocal used, please ensure they are included.  For example:

```
https://www.splunkinstance.com:8000
```

### Auto Cancel

This is an execution setting, that allows a user or admin to set a time limit to cancel a long running query. The value is specified in whole seconds.
  
## Installation Instructions

Installation instructions for integrations are provided on the [PolarityIO GitHub Page](https://polarityio.github.io/).

## Polarity

Polarity is a memory-augmentation platform that improves and accelerates analyst decision making.  For more information about the Polarity platform please see: 

https://polarity.io/
