module.exports = {
    "name": "Splunk",
    "acronym":"Splunk",
    "logging": { level: 'debug'},
    "entityTypes": ['IPv4', 'IPv6', 'hash', 'email'],
    "styles": [
     "./styles/splunk.less"
     ],
     "block": {
     "component": {
     "file": "./components/block.js"
     },
     "template": {
     "file": "./templates/block.hbs"
     }
     },
    "options":[
        {
            "key"          : "host",
            "name"         : "Splunk Host",
            "description"  : "url for splunk instance, please do not include https:// in your url",
            "default"      : "",
            "type"         : "text",
            "userCanEdit" : true,
            "adminOnly"    : false
        },
        {
            "key"          : "port",
            "name"         : "port for splunk rest service - deafult for splunk is 8089",
            "description"  : "",
            "default"      : "8089",
            "type"         : "text",
            "userCanEdit" : true,
            "adminOnly"    : false
        },
        {
            "key"          : "username",
            "name"         : "Username",
            "description"  : "Splunk Account Username",
            "default"      : "",
            "type"         : "text",
            "userCanEdit" : true,
            "adminOnly"    : false
        },
        {
            "key"          : "password",
            "name"         : "Password",
            "description"  : "Splunk Account Password",
            "default"      : "",
            "type"         : "password",
            "userCanEdit" : true,
            "adminOnly"    : false
        },
        {
            "key"          : "searchStringIP",
            "name"         : "Search String for IPs",
            "description"  : "Search you want to perform in splunk for example: search index=logs ip = {{ENTITY}} | head 10",
            "default"      : "",
            "type"         : "text",
            "userCanEdit" : true,
            "adminOnly"    : false
        },
        {
            "key"          : "scheme",
            "name"         : "Scheme",
            "description"  : "scheme for splunk rest service - default for splunk is https",
            "default"      : "https",
            "type"         : "text",
            "userCanEdit" : true,
            "adminOnly"    : false
        },
        {
            "key"          : "version",
            "name"         : "Version",
            "description"  : "Version of Splunk that you are operating",
            "default"      : "",
            "type"         : "text",
            "userCanEdit" : true,
            "adminOnly"    : false
        },
        {
            "key"          : "uiHostname",
            "name"         : "UI Hostname",
            "description"  : "UI Hostname of the Splunk instance you are running",
            "default"      : "",
            "type"         : "text",
            "userCanEdit" : true,
            "adminOnly"    : false
        },
        {
            "key"          : "autoCancel",
            "name"         : "Auto Cancel",
            "description"  : "Number of seconds for a query to run before canceling",
            "default"      : "20",
            "type"         : "text",
            "userCanEdit" : true,
            "adminOnly"    : false
        }

    ]
};