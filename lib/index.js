var fs = require("fs");
var path = require("path");
var matter = require("gray-matter");
var glob = require("glob");
var removeMarkDown = require("remove-markdown");
var stripTags = require("striptags");
var algoliasearch = require("algoliasearch");
var snake = require("to-snake-case");
var _ = require("lodash");
var toml = require("toml");
var { copySettings, copySynonyms, convertToMap } = require("./utils");
var write_key = process.env.ALGOLIA_WRITE_KEY;
var stopword = require("stopword");
var truncate = require("truncate-utf8-bytes");
var nodejieba = require("nodejieba");

nodejieba.load({
    stopWordDict: __dirname + '/stopwords.txt',
});

function HugoAlgolia(options) {
    const self = this;
    this.list = [];
    this.indices = {};

    // Default creds
    this.algoliaCredentials = {
        indexName: "",
        key: "",
        appID: ""
    };

    // Options
    this.input = options.input;
    this.extname = options.extname.split(",");
    this.pathToCredentials = options.config;
    this.output = options.output;
    this.localIndexName = "index";
    this.sendData = options.send;
    this.multInd = false;
    this.writeOtherData = options.all;
    this.language = undefined;
    this.delims = undefined;
    this.contentSize = require("bytes").parse(options.contentSize);

    this.partial = false;
    this.customInd = [];

    this.categoryToIndex = "index";

    // Set custom input
    if (options.toml) {
        this.language = "toml";
        this.delims = "+++";
    }

    // Set multiple indices to true
    if (options.multipleIndices) {
        let categoryToIndex = process.argv[process.argv.indexOf("-m") + 1];

        if (categoryToIndex !== undefined && !categoryToIndex.includes("-")) {
            this.categoryToIndex = categoryToIndex;
        }

        this.multInd = true;
    }

    if (options.customIndex) {
        let customInd = process.argv[process.argv.indexOf("-p") + 1];
        const error = "No categories specified.";

        // We have some args
        if (customInd !== undefined) {
            // Split into array, remove duplicates and falsey values
            customInd = customInd.split(",").map(ind => ind.trim());
            customInd = _.uniq(customInd);
            customInd = _.compact(customInd);

            // Empty quotes
            if (customInd.length === 0) throw error;

            // No args
        } else {
            throw error;
        }

        this.partial = true;
        this.customInd = customInd;
    }

    HugoAlgolia.prototype.setCredentials = function () {
        const configMeta = matter.read(self.pathToCredentials);
        const creds = configMeta.data.algolia;

        if (creds) {
            self.algoliaCredentials = {
                indexName: creds.index,
                key: write_key && write_key !== undefined ? write_key : creds.key,
                appID: creds.appID
            };
            self.localIndexName = creds.index;
        }
    };

    HugoAlgolia.prototype.setUriConfig = function () {
        const configMeta = matter.read(self.pathToCredentials);
        const configUri = configMeta.data.uri;
        const baseURL = configMeta.data.baseURL;
        if (configUri) {
            self.configUri = configUri
        }
        if (baseURL) {
            self.baseURL = baseURL;
            if (baseURL[baseURL.length - 1] != '/')
            {
                self.baseURL.join("/");
            }
        }
    };

    HugoAlgolia.prototype.index = function () {
        self.setCredentials();
        self.setUriConfig();
        self.stream = fs.createWriteStream(self.output);
        self.readDirectory(self.input);

        // Create file with multiple indices
        if (self.multInd) {
            self.handleMultInd(self.list);
            self.stream.write(JSON.stringify(self.indices, null, 4));
        } else {
            self.stream.write(JSON.stringify(self.list, null, 4));
        }

        self.stream.end();
        console.log(`JSON index file was created in ${self.output}`);

        // Send data to algolia only if -s flag = true
        if (self.sendData && self.multInd) {
            for (index in self.indices) {
                //             Obj,                 Name
                self.sendIndex(self.indices[index], index);
            }
        } else if (self.sendData) {
            self.sendIndex();
        }
    };

    HugoAlgolia.prototype.pushToIndices = function (name, obj) {
        let indices = self.indices;
        let isIndexInIndices = indices.hasOwnProperty(name);

        if (!isIndexInIndices) {
            // Check for accidental empty index
            const noSpace = name.replace(/\s/g, "");
            if (noSpace !== "") {
                // Create index in indices and push item into it
                indices[name] = [];
                indices[name].push(obj);
            } else {
                // Push to "other" index
                indices[other].push(obj);
            }
            // Does this index already exist?
        } else {
            indices[name].push(obj);
        }

        indices = self.indices;
    };

    HugoAlgolia.prototype.handleMultInd = function (list) {
        // Set a place for "other" data to go if no index specified
        var other = snake(self.localIndexName + " other");
        var listToIndex = list;

        if (self.writeOtherData) self.indices[other] = [];

        for (item of listToIndex) {
            const obj = item;

            const hasIndex = obj.hasOwnProperty(self.categoryToIndex);
            const indexProp = obj[self.categoryToIndex];

            // Does this item have the index category?
            if (hasIndex) {
                // Is the prop an array of categories?
                if (_.isArray(indexProp)) {
                    for (item of indexProp) {
                        let indexName = snake(self.localIndexName + " " + item);
                        self.pushToIndices(indexName, obj);
                    }
                } else {
                    let indexName = snake(self.localIndexName + " " + indexProp);
                    self.pushToIndices(indexName, obj);
                }
            } else if (self.writeOtherData) {
                self.pushToIndices(other, obj);
            }
        }
    };

    HugoAlgolia.prototype.sendIndex = function (indObj, name) {
        // Send data to Algolia
        const { key, appID } = self.algoliaCredentials;
        const indexName = name ? name : self.algoliaCredentials.indexName;
        const client = algoliasearch(appID, key);
        const index = client.initIndex(indexName);
        const tmpIndex = client.initIndex(`${indexName}-temp`);
        const indexToSend = indObj ? indObj : self.list;

        // Copy index settings/synonyms to new index
        copySettings(index, tmpIndex);
        copySynonyms(index, tmpIndex);

        tmpIndex.addObjects(indexToSend, (err, content) => {
            if (err) {
                console.log(err);
                return;
            }

            client.moveIndex(tmpIndex.indexName, index.indexName, (err, content) => {
                if (err) {
                    console.log(err);
                } else {
                    console.log(content);
                }
            });
        });
    };

    HugoAlgolia.prototype.readDirectory = function (filePath) {
        const files = glob.sync(filePath);
        var counts = 0;
        for (let i = 0; i < files.length; i++) {
            var skip = true;
            var extname = path.extname(files[i]);
            for (var idx in self.extname) {
                if (self.extname[idx] == extname) {
                    skip = false;
                    break;
                }
            }
            if (skip) continue;

            let stats = fs.lstatSync(files[i]);

            // Remove folders, only gather actual files
            if (!stats.isDirectory()) {
                // If this is not a directory/folder, read the file
                self.readFile(files[i]);
                counts++;
            }
        }
        console.log("from", filePath, "prefix", self.extname, "record counts", counts);
    };

    HugoAlgolia.prototype.formatUri = function (format, items) {
        return format.replace(/:year/g, items.year)
            .replace(/:month/g, items.month)
            .replace(/:day/g, items.day)
            .replace(/:slug/g, items.slug);
    }

    String.prototype.padLeft =
        Number.prototype.padLeft = function (total, pad) {
            return (Array(total).join(pad || 0) + this).slice(-total);
        }

    HugoAlgolia.prototype.formatDataInFile = function (meta, filePath) {
        // Define algolia object
        var item = {};
        var uri = "/" + filePath.substring(filePath.lastIndexOf("./"));
        let _this = this;

        // console.log(meta.data)
        if (meta.data) {
            privItem = {}

            for (prop in meta.data) {
                item[prop] = meta.data[prop];
                privItem[prop] = meta.data[prop];
            }

            if (privItem.date) {
                var date = new Date(privItem.date);
                var year = date.getFullYear();
                var month = date.getMonth() + 1;
                var day = date.getDate();
                privItem["year"] = year.padLeft(4);
                privItem["month"] = month.padLeft(2);
                privItem["day"] = day.padLeft(2);
            }

            item.uri = uri
                .split("/")
                .splice(2)
                .join("/")
                .replace(/\.[^/.]+$/, "");
            //Remove _index + index files from uri
            const compUriArray = item.uri.split("/");
            const lastItemInCompArray = compUriArray[compUriArray.length - 1];
            if (
                lastItemInCompArray.includes("index") ||
                lastItemInCompArray.includes("_index")
            ) {
                compUriArray.pop();
                item.uri = compUriArray.join("/");
            }

            item.uri = meta.data.slug ? _this.formatUri(_this.configUri, privItem) : item.uri;
            item.uri = meta.data.uri ? meta.data.uri : item.uri;
            item.uri = self.baseURL + item.uri;

            let contentDict = nodejieba.extract(meta.content, -1);
            let content = []
            for (var patch in contentDict)
            {
                content.push(contentDict[patch]["word"]);
            }
            content = Array.from(new Set(content));
            content = content
                .join(" ")
                .trim();
            let truncatedContent = truncate(content, _this.contentSize); // 20kB limit
            // console.log(truncatedContent);
            item.content = truncatedContent;

            // If this is a partial index, remove everything but the props we want
            if (self.partial) {
                item = _.pick(item, self.customInd);
            }

            // Include an objectID to prevent duplicated entries in the index.
            item.objectID = meta.data.objectID
                ? meta.data.objectID
                : item.uri

            item.title = item.title ? item.title : item.objectID;
        }
        // console.log("===============")
        return item;
    };

    HugoAlgolia.prototype.readFile = function (filePath) {
        const ext = path.extname(filePath);
        const meta = matter.read(filePath, {
            language: self.language,
            delims: self.delims,
            engines: {
                toml: toml.parse.bind(toml)
            }
        });

        // We don't want to index this if the index is false or
        // this document is a draft.
        if (meta.data.index === false || meta.data.draft === true) return;

        meta.content = removeMarkDown(meta.content);
        meta.content = stripTags(meta.content);

        var item = self.formatDataInFile(meta, filePath);

        if (!_.isEmpty(item)) self.list.push(item);
    };
}

module.exports = HugoAlgolia;
