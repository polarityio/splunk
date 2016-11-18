module.exports = {
    "name": "Splunk",
    "acronym":"Splunk",
    "logging": { level: 'debug'},
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
            "user-can-edit" : true,
            "admin-only"    : false
        },
        {
            "key"          : "port",
            "name"         : "port for splunk rest service - deafult for splunk is 8089",
            "description"  : "",
            "default"      : "",
            "type"         : "text",
            "user-can-edit" : true,
            "admin-only"    : false
        },
        {
            "key"          : "username",
            "name"         : "Username",
            "description"  : "Splunk Account Username",
            "default"      : "",
            "type"         : "text",
            "user-can-edit" : true,
            "admin-only"    : false
        },
        {
            "key"          : "password",
            "name"         : "Password",
            "description"  : "Splunk Account Password",
            "default"      : "",
            "type"         : "password",
            "user-can-edit" : true,
            "admin-only"    : false
        },
        {
            "key"          : "searchString",
            "name"         : "Search String",
            "description"  : "Search you want to perform in splunk for example: search index=logs ip = {{ENTITY}} | head 10",
            "default"      : "",
            "type"         : "text",
            "user-can-edit" : true,
            "admin-only"    : false
        },
        {
            "key"          : "scheme",
            "name"         : "Scheme",
            "description"  : "scheme for splunk rest service - default for splunk is https",
            "default"      : "",
            "type"         : "text",
            "user-can-edit" : true,
            "admin-only"    : false
        },
        {
            "key"          : "version",
            "name"         : "Version",
            "description"  : "Version of Splunk that you are operating",
            "default"      : "",
            "type"         : "text",
            "user-can-edit" : true,
            "admin-only"    : false
        },
        {
            "key"          : "uiHostname",
            "name"         : "UI Hostname",
            "description"  : "UI Hostname of the Splunk instance you are running",
            "default"      : "",
            "type"         : "text",
            "user-can-edit" : true,
            "admin-only"    : false
        }
    ]
};