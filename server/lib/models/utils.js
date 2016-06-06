
var util = require("util");

module.exports = (function() { 

    function extractProperties(nodeData) { 
        console.log(typeof nodeData);
        if(typeof nodeData === "undefined" || nodeData === null) { return {}; }
        var properties = (!('data' in nodeData)) ? {} : nodeData.data;
        return properties;
    };

    return { 
        extractProperties: extractProperties
    };

}());