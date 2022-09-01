'use strict';

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  init() {
    this.initializeBlock();

    if(!this.get('block._state')){
      this.set('block._state', {});
    }

    this._super(...arguments);
  },
  initializeBlock(){
    this.get('details.results').forEach((result, index) => {
      this._initFields(index);
      Ember.set(result, 'showFields', true);
      Ember.set(result, 'showTable', false);
      Ember.set(result, 'showJson', false);
      Ember.set(result, 'showSource', false);
    });
  },
  isDirectSearch: Ember.computed('block.entity.subtype', function(){
    return this.get('block.entity.subtype') === 'custom.splunkSearch';
  }),
  hasSearchSyntaxErrors: Ember.computed('details.searchSyntaxErrors', function(){
    return this.get('details.searchSyntaxErrors.length') > 0;
  }),
  actions: {
    showFields: function(index) {
      this.set('details.results.' + index + '.showTable', false);
      this.set('details.results.' + index + '.showJson', false);
      this.set('details.results.' + index + '.showSource', false);
      this.set('details.results.' + index + '.showFields', true);
    },
    showTable: function(index) {
      this.set('details.results.' + index + '.showTable', true);
      this.set('details.results.' + index + '.showJson', false);
      this.set('details.results.' + index + '.showSource', false);
      this.set('details.results.' + index + '.showFields', false);
    },
    showJson: function(index) {
      if (typeof this.get('details.results.' + index + '.json') === 'undefined') {
        this.set(
          'details.results.' + index + '.json',
          this.syntaxHighlight(JSON.stringify(this.get('details.results.' + index + '.result'), null, 4))
        );
      }
      this.set('details.results.' + index + '.showTable', false);
      this.set('details.results.' + index + '.showJson', true);
      this.set('details.results.' + index + '.showSource', false);
      this.set('details.results.' + index + '.showFields', false);
    },
    showSource: function(index) {
      this._initSource(index);
      this.set('details.results.' + index + '.showTable', false);
      this.set('details.results.' + index + '.showJson', false);
      this.set('details.results.' + index + '.showSource', true);
      this.set('details.results.' + index + '.showFields', false);
    },
    search: function(){
      const payload = {
        action: "SEARCH",
        entity: this.get('block.entity'),
        search: this.get('details.search')
      }

      this.set('block._state.searchRunning', true);
      this.set('block._state.errorMessage', '');

      this.sendIntegrationMessage(payload).then((details) => {
        this.set('block.data.details', details);
        this.initializeBlock();
      }).catch((err) => {
        this.set('block._state.errorMessage', JSON.stringify(err, null, 4));
      }).finally(() => {
        this.set('block._state.searchRunning', false);
      })
    }
  },
  _initFields(index) {
    const _source = this.get('details.results.' + index + '.result');
    const fields = [];
    for (let key in _source) {
      if (!key.startsWith('_')) {
        fields.push({ key: key, value: _source[key] });
      }
    }
    this.set('details.results.' + index + '.fields', fields);
  },
  _initSource(index) {
    if (typeof this.get('details.results.' + index + '.sourceStringified') === 'undefined') {
      const _source = this.get('details.results.' + index + '.result');
      const _sourceStringified = {};
      Object.entries(_source).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null && Array.isArray(value) === false) {
          _sourceStringified[key] = JSON.stringify(value, null, 0);
        } else {
          _sourceStringified[key] = value;
        }
      });
      this.set('details.results.' + index + '.sourceStringified', _sourceStringified);
    }
  },
  syntaxHighlight(json) {
    json = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      function(match) {
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
