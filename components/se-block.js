'use strict';

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  init() {
    this.get('details.results').forEach((result, index) => {
      this._initFields(index);
      Ember.set(result, 'showFields', true);
      Ember.set(result, 'showTable', false);
      Ember.set(result, 'showJson', false);
      Ember.set(result, 'showSource', false);
    });
    this._super(...arguments);
  },
  onDetailsOpened() {
    this.get('details.results').forEach((result, index) => {
      this._initFields(index);
      Ember.set(result, 'showFields', true);
      Ember.set(result, 'showTable', false);
      Ember.set(result, 'showJson', false);
      Ember.set(result, 'showSource', false);
    });
  },
  actions: {
    showFields: function (index) {
      this.set('details.results.' + index + '.showTable', false);
      this.set('details.results.' + index + '.showJson', false);
      this.set('details.results.' + index + '.showSource', false);
      this.set('details.results.' + index + '.showFields', true);
    },
    showTable: function (index) {
      if (typeof this.get('details.results.' + index + '.table') === 'undefined') {
        const results = this.get('details.results.' + index + '.result');
        let table = {};
        results.forEach((row) => {
          table[row.key] = row.value;
        });
        this.set('details.results.' + index + '.table', table);
      }
      this.set('details.results.' + index + '.showTable', true);
      this.set('details.results.' + index + '.showJson', false);
      this.set('details.results.' + index + '.showSource', false);
      this.set('details.results.' + index + '.showFields', false);
    },
    showJson: function (index) {
      if (typeof this.get('details.results.' + index + '.json') === 'undefined') {
        const results = this.get('details.results.' + index + '.result');
        let json = {};
        results.forEach((row) => {
          json[row.key] = row.value;
        });
        this.set(
          'details.results.' + index + '.json',
          this.syntaxHighlight(JSON.stringify(json, null, 4))
        );
      }
      this.set('details.results.' + index + '.showTable', false);
      this.set('details.results.' + index + '.showJson', true);
      this.set('details.results.' + index + '.showSource', false);
      this.set('details.results.' + index + '.showFields', false);
    },
    showSource: function (index) {
      this._initSource(index);
      this.set('details.results.' + index + '.showTable', false);
      this.set('details.results.' + index + '.showJson', false);
      this.set('details.results.' + index + '.showSource', true);
      this.set('details.results.' + index + '.showFields', false);
    }
  },
  _initFields(index) {
    // We don't need to init anything for index discovery searches as the format
    // of the return payload is different along with the template
    if (this.get('details.searchType') == 'meta') {
      return;
    }

    const _source = this.get('details.results.' + index + '.result');
    const fields = [];

    // Don't show any fields that are internal Splunk fields (i.e., start with an underscore)
    _source.forEach((row) => {
      if (!row.key.startsWith('_')) {
        fields.push(row);
      }
    });

    this.set('details.results.' + index + '.fields', fields);
  },
  _initSource(index) {
    if (
      typeof this.get('details.results.' + index + '.sourceStringified') === 'undefined'
    ) {
      const _source = this.get('details.results.' + index + '.result');
      const _sourceStringified = {};
      _source.forEach(({ key, value }) => {
        if (
          typeof value === 'object' &&
          value !== null &&
          Array.isArray(value) === false
        ) {
          _sourceStringified[key] = JSON.stringify(value, null, 0);
        } else {
          _sourceStringified[key] = value;
        }
      });
      this.set('details.results.' + index + '.sourceStringified', _sourceStringified);
    }
  },
  syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'key';
          } else {
            cls = 'string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'boolean';
        } else if (/null/.test(match)) {
          cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      }
    );
  }
});
