/**
 *  Shared common model utility functions for processing results, handling
 *  exceptions, formatting returned output etc.
**/

var g = require('../graffeine/common');

var helper = { 

    command: null,
    before: null,
    after: null,

    /**
     *  Maps a list of neo4j node objects, from an index query, to a set containing
     *  only the obj.data information
     *
     *  @param {array} nodes list of neo4j nodes for processing
     *  @returns {array} list of nodes reduced to node.data info
    **/

    mapIndexQueryResult: function(nodes) {
        return nodes.map(function (node) { return node.data; });
    },

    /**
     * Works out a value for the 'name' field from whatever exists in the neo4j node
     * @todo: fold into 'setGraffNodeTypeFromData'
    **/

    setGraffNodeNameFromData: function (nodeData) { 
        g.debug("(setGraffNodeNameFromData) trying to set node name");
        var possibleNameFields = g.config.graph.nameFields;
        g.debug("(setGraffNodeNameFromData) possible field sources: " + possibleNameFields);
        for(var i=0; i<possibleNameFields.length; i++) { 
            var field = possibleNameFields[i];
            g.debug("(setGraffNodeNameFromData) checking field: " + field);
            if(nodeData[field] !== undefined) { 
                g.debug("(setGraffNodeNameFromData) found field: " + field + " with value " + nodeData[field]);
                return nodeData[field];
            }
        };
        g.debug("(setGraffNodeNameFromData) defaulting to '-'");
        return '-';
    },

    /**
     *  Works out a value for the 'type' field from whatever exists in the neo4j node
     * todo: fold into 'setGraffNodeNameFromData'
    **/

    setGraffNodeTypeFromData: function (nodeData) { 
        if(g.config.graph.useNameAsType) { 
            g.debug("(setGraffNodeTypeFromData) config set to use node name field as type");
            return nodeData.name;
        }
        g.debug("(setGraffNodeTypeFromData) trying to set node type");
        var possibleTypeFields = g.config.graph.typeFields;
        g.debug("(setGraffNodeTypeFromData) possible field sources: " + possibleTypeFields);
        for(var i=0; i<possibleTypeFields.length; i++) { 
            var field = possibleTypeFields[i];
            g.debug("(setGraffNodeTypeFromData) checking field: " + field);
            if(nodeData[field] !== undefined) { 
                g.debug("(setGraffNodeTypeFromData) found field: " + field + " with value " + nodeData[field]);
                return nodeData[field];
            }
        };
        g.debug("(setGraffNodeTypeFromData) defaulting to 'default'");
        return 'default';
    },

    /**
     *  Calculate css styling for GraffNode
    **/

    setGraffNodeStyleFromData: function(nodeData) { 
        var nodeStyle = {};
        var defaultStyle = g.config.nodes.default.style;
        if(!g.config.graph.useCssStyle) { 
            Object.keys(defaultStyle).forEach(function(key) { nodeStyle[key] = defaultStyle[key]; });
            if(g.config.nodes[nodeData.type] !== undefined && g.config.nodes[nodeData.type].style !== undefined) {
                Object.keys(g.config.nodes[nodeData.type].style).forEach(function(key){
                    nodeStyle[key] = g.config.nodes[nodeData.type].style[key];
                });
            }
        }
        return nodeStyle;
    },

    /**
     *  Unifies node and relationship cypher results into a single graffNode object.
     *  Nodes are denoted either by the column name (n or m) or by passing type
     *  to the function.
     *
     *  @param {neo4JNodeObj} neoNode neo4j node or relationship query result
     *  @todo major refactor required
    **/

    buildGraffNode: function(neoNode) { 

        var neoType = neoNode.node;
        var graffNode = {};

        graffNode.data   = neoNode.data || {};
        graffNode.id     = neoNode.id;
        graffNode.self   = neoNode.self;
        graffNode.exists = neoNode.exists;

        if(neoType === 'r') {
            graffNode.node   = 'r';
            graffNode.type   = neoNode.type || '-';
            graffNode.start  = neoNode.start.id;
            graffNode.end    = neoNode.end.id;
            return graffNode;
        }

        if(neoType === 'n' || neoType === 'm') { 

            graffNode.node   = 'n';
            graffNode.labels = neoNode.labels;
            graffNode.name   = helper.setGraffNodeNameFromData(neoNode.data);
            graffNode.type   = helper.setGraffNodeTypeFromData(neoNode.data);
            graffNode.cssClass = graffNode.type;

            // @todo: remove in favour of cssClass only
            //graffNode.style  = helper.setGraffNodeStyleFromData(neoNode.data);

            graffNode.label  = { fill: '#000000' };

            // Set extras
            /**
            [ 'icon' ].forEach(function(c) {
                if(g.config.nodes[graffNode.type]) {
                    if(g.config.nodes[graffNode.type][c] !== undefined)
                        graffNode[c] = g.config.nodes[graffNode.type][c];
                    else
                        graffNode[c] = g.config.nodes['default'][c];
                }
                else {
                    graffNode[c] = g.config.nodes['default'][c];
                }
            });
            **/

            return graffNode;
        }

        console.log("WARNING: (graffNode) : unknown node type " + neoType);
    },

    mapCypherQueryResult: function(results, columnsWanted) {

        var items = [];
        columnsWanted = (columnsWanted === undefined) ? [] : columnsWanted;

        results.forEach(function(resultObj) {

            var resultColumns = Object.keys(resultObj);

            resultColumns.forEach(function(column) { 

                if(column==='labels') return;

                if(columnsWanted.indexOf(column.toString()) !== -1) { 

                    /** some path columns come back null **/

                    if(resultObj[column]!==null) { 
                        // Arrays are always paths
                        if(resultObj[column] instanceof Array) {
                            resultObj[column].forEach(function(path) {
                                var item = path;
                                item.node = 'r';
                                items.push(item);
                            });
                        }
                        else { 
                            var item = resultObj[column];
                            item.node = column;
                            item.labels = resultObj['labels'] ? resultObj['labels'] : [];
                            items.push(item);
                        }
                    }
                }
                else {
                    // console.log("Column " + column + " not in " + columnsWanted);
                }

            });

        });

        return items.map(helper.buildGraffNode);

    },

    processQueryResult: function(callback, processor, columns, timer) { 
        var self = this;
        return function(err, results) { 
            if (err) { 
                helper.errorHandler(function(){})(err);
            }
            else { 
                var nodes = processor(results, columns);
                timer.end = new Date().getTime();
                console.log((timer.end-timer.start) + ": \"" + timer.command.replace(/\r?\n|\r/g, " ") + "\"");
                // @todo: refactor out global
                if(global.graffeineClientSocket!==undefined) { 
                    global.graffeineClientSocket.emit('query-data', { 
                        data: timer,
                        updatedAt: new Date().getTime()
                    });
                };

                callback(nodes);
            }
        }
    },

    /**
     *  Cypher query runner
     *
     *  @param {string} cypher the cypher query
     *  @param {callback} callback function to receive the result
     *  @param {array|string} columns the columns to return from the results query
    **/

    runQuery: function(cypher, callback, columns) { 

        g.debug("(runQuery) : begin");
        g.debug(cypher);
        g.debug("(runQuery) : end");

        if(columns === undefined) { 
            g.debug("(runQuery) : expecting boolean result");
            g.db.conn.query(cypher, {}, helper.booleanResult(callback));
        }
        else { 
            if(typeof(columns)=="string") { 
                g.debug("(runQuery) : expecting aggregate result");
                var proc = helper.mapCypherAggregateResult;
            }
            else { // columns is array therefore it's a regular query
                g.debug("(runQuery) : expecting query result");
                var proc = helper.mapCypherQueryResult;
            }
            var timer = { command: cypher, start: new Date().getTime() };
            g.db.conn.query(cypher, {}, helper.processQueryResult(callback, proc, columns, timer));
        }

    },

    booleanResult: function(callback) { 
        return function(err, result) { 
            if(err)
                helper.errorHandler(function(){})(err);
            else
                callback(true);
        }
    },

    /**
     *  Parses the result of an aggregate (count, sum, avg) cypher query
    **/

    mapCypherAggregateResult: function(results, key) { 
        return results[0][key];
    },

    /**
     *  Generic error handler for single node adds and gets. Passes the neo4j node
     *  through GraffNode on the way back to standardise it for d3 consumption
     *
     *  @param {function} callback
    **/

    errorHandler: function(callback) { 

        return function(err, result) { 

            if (err) { 
                if(err.code==='ECONNREFUSED') { 
                    // @todo: refactor out global
                    if(global.graffeineClientSocket!==undefined) { 
                        global.graffeineClientSocket.emit('server-message', { 
                            category: 'error',
                            title: 'neo4j error',
                            message: "Cannot connect to Neo4J. Is it running?", 
                            updatedAt: new Date().getTime()
                        });
                    };
                    callback(null);
                }
                else { 
                    g.error(err, result);
                    callback(null);
                }

            }
            else { 
                result.node = 'n';
                var graffNode = helper.buildGraffNode(result);
                callback(graffNode);
            }
        }
    }

};

exports.conn  = g.db.conn;
exports.utils = helper;
