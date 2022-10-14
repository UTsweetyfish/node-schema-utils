'use strict';

var ajvErrors = require('../index');
var Ajv = require('ajv');
var assert = require('assert');


describe('errorMessage value is an object', function() {
  var ajvs;

  beforeEach(function() {
    ajvs = [
      ajvErrors(new Ajv({allErrors: true, jsonPointers: true/*, sourceCode: true, processCode: require('js-beautify').js_beautify*/ })),
      ajvErrors(new Ajv({allErrors: true, jsonPointers: true, verbose: true/*, sourceCode: true, processCode: require('js-beautify').js_beautify*/ }))
    ];
  });

  describe('keywords', function() {
    it('should replace keyword errors with custom error messages', function() {
      var schema = {
        type: 'object',
        required: ['foo'],
        properties: {
          foo: { type: 'integer' }
        },
        additionalProperties: false,
        errorMessage: {
          type: 'should be an object',
          required: 'should have property foo',
          additionalProperties: 'should not have properties other than foo'
        }
      };

      ajvs.forEach(function (ajv) {
        var validate = ajv.compile(schema);
        assert.strictEqual(validate({foo: 1}), true);
        testInvalid({},                 [['required']]);
        testInvalid({bar: 2},           [['required'], ['additionalProperties']]);
        testInvalid({foo: 1, bar: 2},   [['additionalProperties']]);
        testInvalid({foo: 'a'},         ['type']);
        testInvalid({foo: 'a', bar: 2}, ['type', ['additionalProperties']]);
        testInvalid(1,                  [['type']]);

        function testInvalid(data, expectedErrors) {
          assert.strictEqual(validate(data), false);
          assert.strictEqual(validate.errors.length, expectedErrors.length);
          validate.errors.forEach(function (err, i) {
            var expectedErr = expectedErrors[i];
            if (Array.isArray(expectedErr)) { // errorMessage error
              assert.strictEqual(err.keyword, 'errorMessage');
              assert.strictEqual(err.message, schema.errorMessage[err.params.errors[0].keyword]);
              assert.strictEqual(err.dataPath, '');
              assert.strictEqual(err.schemaPath, '#/errorMessage');
              var replacedKeywords = err.params.errors.map(function (e) {
                return e.keyword;
              });
              assert.deepEqual(replacedKeywords.sort(), expectedErr.sort());
            } else { // original error
              assert.strictEqual(err.keyword, expectedErr);
            }
          });
        }
      });
    });

    describe('keyword errors with interpolated error messages', function() {
      var schema, validate;

      it('should replace errors', function() {
        schema = {
          type: 'object',
          properties: {
            foo: {
              type: 'number',
              minimum: 5,
              maximum: 10,
              errorMessage: {
                type: 'property ${0#} should be number, it is ${0}',
                minimum: 'property ${0#} should be >= 5, it is ${0}',
                maximum: 'property foo should be <= 10'
              }
            }
          }
        };

        ajvs.forEach(function (ajv) {
          validate = ajv.compile(schema);
          assert.strictEqual(validate({foo: 7}), true);
          testInvalid({foo: 'a'},   [['type']]);
          testInvalid({foo: ['a']}, [['type']]);
          testInvalid({foo: 4.5},   [['minimum']]);
          testInvalid({foo: 10.5},  [['maximum']]);
        });
      });

      it('should replace keyword errors with interpolated error messages with type integer', function() {
        schema = {
          type: 'object',
          properties: {
            foo: {
              type: 'integer',
              minimum: 5,
              maximum: 10,
              errorMessage: {
                type: 'property ${0#} should be integer, it is ${0}',
                minimum: 'property ${0#} should be >= 5, it is ${0}',
                maximum: 'property foo should be <= 10'
              }
            }
          }
        };

        ajvs.forEach(function (ajv) {
          validate = ajv.compile(schema);
          assert.strictEqual(validate({foo: 7}), true);
          testInvalid({foo: 'a'},   [['type']]);
          testInvalid({foo: ['a']}, [['type']]);
          testInvalid({foo: 5.5},   [['type']]);
          testInvalid({foo: 4.5},   [['type'], ['minimum']]);
          testInvalid({foo: 4},   [['minimum']]);
          testInvalid({foo: 11},  [['maximum']]);
        });
      });

      function testInvalid(data, expectedErrors) {
        assert.strictEqual(validate(data), false);
        assert.strictEqual(validate.errors.length, expectedErrors.length);
        validate.errors.forEach(function (err, i) {
          var expectedErr = expectedErrors[i];
          if (Array.isArray(expectedErr)) { // errorMessage error
            assert.strictEqual(err.keyword, 'errorMessage');
            var expectedMessage = schema.properties.foo
                                  .errorMessage[err.params.errors[0].keyword]
                                  .replace('${0#}', '"foo"')
                                  .replace('${0}', JSON.stringify(data.foo));
            assert.strictEqual(err.message, expectedMessage);
            assert.strictEqual(err.dataPath, '/foo');
            assert.strictEqual(err.schemaPath, '#/properties/foo/errorMessage');
            var replacedKeywords = err.params.errors.map(function (e) {
              return e.keyword;
            });
            assert.deepEqual(replacedKeywords.sort(), expectedErr.sort());
          } else { // original error
            assert.strictEqual(err.keyword, expectedErr);
          }
        });
      }
    });

    describe('"required" and "dependencies" keywords errors for specific properties', function() {
      var schema, validate;

      it('should replace required errors with messages', function() {
        schema = {
          type: 'object',
          required: ['foo', 'bar'],
          properties: {
            foo: { type: 'integer' },
            bar: { type: 'string' }
          },
          errorMessage: {
            type: 'should be an object',
            required: {
              foo: 'an integer property "foo" is required',
              bar: 'a string property "bar" is required'
            }
          }
        };

        ajvs.forEach(function (ajv) {
          validate = ajv.compile(schema);
          assert.strictEqual(validate({foo: 1, bar: 'a'}), true);
          testInvalid({},         [{required: 'foo'}, {required: 'bar'}]);
          testInvalid({foo: 1},   [{required: 'bar'}]);
          testInvalid({foo: 'a'}, ['type', {required: 'bar'}]);
          testInvalid({bar: 'a'}, [{required: 'foo'}]);
        });
      });

      it('should replace required errors with messages only for specific properties', function() {
        schema = {
          type: 'object',
          required: ['foo', 'bar'],
          properties: {
            foo: { type: 'integer' },
            bar: { type: 'string' }
          },
          errorMessage: {
            type: 'should be an object',
            required: {
              foo: 'an integer property "foo" is required'
            }
          }
        };

        ajvs.forEach(function (ajv) {
          validate = ajv.compile(schema);
          assert.strictEqual(validate({foo: 1, bar: 'a'}), true);
          testInvalid({},         ['required', {required: 'foo'}]);
          testInvalid({foo: 1},   ['required']);
          testInvalid({foo: 'a'}, ['type', 'required']);
          testInvalid({bar: 'a'}, [{required: 'foo'}]);
        });
      });

      it('should replace required and dependencies errors with messages', function() {
        schema = {
          type: 'object',
          required: ['foo', 'bar'],
          properties: {
            foo: { type: 'integer' },
            bar: { type: 'string' }
          },
          dependencies: {
            foo: ['quux'],
            bar: ['boo']
          },
          errorMessage: {
            type: 'should be an object',
            required: {
              foo: 'an integer property "foo" is required, "bar" is ${/bar}',
              bar: 'a string property "bar" is required, "foo" is ${/foo}'
            },
            dependencies: {
              foo: '"quux" should be present when "foo" is present, "foo" is ${/foo}',
              bar: '"boo" should be present when "bar" is present, "bar" is ${/bar}'
            }
          }
        };

        ajvs.forEach(function (ajv) {
          validate = ajv.compile(schema);
          assert.strictEqual(validate({foo: 1, bar: 'a', quux: 2, boo: 3}), true);
          testInvalid({},         [{required: 'foo'}, {required: 'bar'}]);
          testInvalid({foo: 1},   [{required: 'bar'}, {dependencies: 'foo'}]);
          testInvalid({foo: 'a'}, ['type', {required: 'bar'}, {dependencies: 'foo'}]);
          testInvalid({bar: 'a'}, [{required: 'foo'}, {dependencies: 'bar'}]);
          testInvalid({foo: 1, bar: 'a'}, [{dependencies: 'foo'}, {dependencies: 'bar'}]);
          testInvalid({foo: 1, bar: 'a', quux: 2}, [{dependencies: 'bar'}]);
        });
      });

      it('should replace required errors with interpolated messages', function() {
        schema = {
          type: 'object',
          required: ['foo', 'bar'],
          properties: {
            foo: { type: 'integer' },
            bar: { type: 'string' }
          },
          errorMessage: {
            type: 'should be an object',
            required: {
              foo: 'an integer property "foo" is required, "bar" is ${/bar}',
              bar: 'a string property "bar" is required, "foo" is ${/foo}'
            }
          }
        };

        ajvs.forEach(function (ajv) {
          validate = ajv.compile(schema);
          assert.strictEqual(validate({foo: 1, bar: 'a'}), true);
          testInvalid({},         [{required: 'foo'}, {required: 'bar'}]);
          testInvalid({foo: 1},   [{required: 'bar'}]);
          testInvalid({foo: 'a'}, ['type', {required: 'bar'}]);
          testInvalid({bar: 'a'}, [{required: 'foo'}]);
        });
      });

      function testInvalid(data, expectedErrors) {
        assert.strictEqual(validate(data), false);
        assert.strictEqual(validate.errors.length, expectedErrors.length);
        validate.errors.forEach(function (err, i) {
          var expectedErr = expectedErrors[i];
          if (typeof expectedErr == 'object') { // errorMessage error
            var errKeyword = Object.keys(expectedErr)[0];
            var errProp = expectedErr[errKeyword];

            assert.strictEqual(err.keyword, 'errorMessage');
            var expectedMessage = schema.errorMessage[errKeyword][errProp]
                                  .replace('${/foo}', JSON.stringify(data.foo))
                                  .replace('${/bar}', JSON.stringify(data.bar));
            assert.strictEqual(err.message, expectedMessage);
            assert.strictEqual(err.dataPath, '');
            assert.strictEqual(err.schemaPath, '#/errorMessage');
            var replacedKeywords = err.params.errors.map(function (e) {
              return e.keyword;
            });
            assert.deepEqual(replacedKeywords, Object.keys(expectedErr));
          } else { // original error
            assert.strictEqual(err.keyword, expectedErr);
          }
        });
      }
    });
  });

  describe('properties and items', function() {
    var schema, validate;

    describe('properties only', function() {
      beforeEach(function() {
        schema = {
          type: 'object',
          required: ['foo', 'bar'],
          properties: {
            foo: {
              type: 'object',
              required: ['baz'],
              properties: {
                baz: {type: 'integer', maximum: 2}
              }
            },
            bar: {
              type: 'array',
              items: {type: 'string', maxLength: 3},
              minItems: 1
            }
          },
          additionalProperties: false,
          errorMessage: 'will be replaced in each test'
        };
      });

      it('should replace errors for properties with custom error messages', function() {
        schema.errorMessage = {
          properties: {
            foo: 'data.foo should be an object with the integer property "baz" <= 2',
            bar: 'data.bar should be an array with at least one string item with length <= 3'
          }
        };

        testProperties();
      });

      it('should replace errors for properties with interpolated error messages', function() {
        schema.errorMessage = {
          properties: {
            foo: 'data.foo should be an object with the integer property "baz" <= 2, "baz" is ${/foo/baz}',
            bar: 'data.bar should be an array with at least one string item with length <= 3, "bar" is ${/bar}'
          }
        };

        testProperties(tmpl);

        function tmpl(str, data) {
          return str.replace('${/foo/baz}', JSON.stringify(data.foo && data.foo.baz))
                    .replace('${/bar}', JSON.stringify(data.bar));

        }
      });

      function testProperties(tmpl) {
        var validData = {
          foo: {baz: 1},
          bar: ['abc']
        };

        ajvs.forEach(function (ajv) {
          validate = ajv.compile(schema);

          assert.strictEqual(validate(validData), true);
          testInvalid({},                 ['required', 'required'], tmpl);
          testInvalid({foo: 1},           ['required', ['type']], tmpl);
          testInvalid({foo: 1, bar: 2},   [['type'], ['type']], tmpl);
          testInvalid({foo: {baz: 'a'}},  ['required', ['type']], tmpl);
          testInvalid({foo: {baz: 3}},    ['required', ['maximum']], tmpl);
          testInvalid({foo: {baz: 3}, bar: []},       [['maximum'], ['minItems']], tmpl);
          testInvalid({foo: {baz: 3}, bar: [1]},      [['maximum'], ['type']], tmpl);
          testInvalid({foo: {baz: 3}, bar: ['abcd']}, [['maximum'], ['maxLength']], tmpl);
        });
      }
    });

    describe('items only', function() {
      beforeEach(function() {
        schema = {
          type: 'array',
          items: [
            {
              type: 'object',
              required: ['baz'],
              properties: {
                baz: {type: 'integer', maximum: 2}
              }
            },
            {
              type: 'array',
              items: {type: 'string', maxLength: 3},
              minItems: 1
            }
          ],
          minItems: 2,
          additionalItems: false,
          errorMessage: 'will be replaced in each test'
        };
      });

      it('should replace errors for items with custom error messages', function() {
        schema.errorMessage = {
          items: [
            'data[0] should be an object with the integer property "baz" <= 2',
            'data[1] should be an array with at least one string item with length <= 3'
          ]
        };

        testItems();
      });

      it('should replace errors for items with interpolated error messages', function() {
        schema.errorMessage = {
          items: [
            'data[0] should be an object with the integer property "baz" <= 2, data[0].baz is ${/0/baz}',
            'data[1] should be an array with at least one string item with length <= 3, data[1] is ${/1}'
          ]
        };

        testItems(tmpl);

        function tmpl(str, data) {
          return str.replace('${/0/baz}', JSON.stringify(data[0] && data[0].baz))
                    .replace('${/1}', JSON.stringify(data[1]));

        }
      });

      function testItems(tmpl) {
        var validData = [
          {baz: 1},
          ['abc']
        ];

        ajvs.forEach(function (ajv) {
          validate = ajv.compile(schema);

          assert.strictEqual(validate(validData), true);
          testInvalid([],            ['minItems'], tmpl);
          testInvalid([1],           ['minItems', ['type']], tmpl);
          testInvalid([1, 2],        [['type'], ['type']], tmpl);
          testInvalid([{baz: 'a'}],  ['minItems', ['type']], tmpl);
          testInvalid([{baz: 3}],    ['minItems', ['maximum']], tmpl);
          testInvalid([{baz: 3}, []],       [['maximum'], ['minItems']], tmpl);
          testInvalid([{baz: 3}, [1]],      [['maximum'], ['type']], tmpl);
          testInvalid([{baz: 3}, ['abcd']], [['maximum'], ['maxLength']], tmpl);
        });
      }
    });

    describe('both properties and items', function() {
      beforeEach(function() {
        schema = {
          definitions: {
            foo: {
              type: 'object',
              required: ['baz'],
              properties: {
                baz: {type: 'integer', maximum: 2}
              }
            },
            bar: {
              type: 'array',
              items: {type: 'string', maxLength: 3},
              minItems: 1
            }
          },
          anyOf: [
            {
              type: 'object',
              required: ['foo', 'bar'],
              properties: {
                foo: {$ref: '#/definitions/foo'},
                bar: {$ref: '#/definitions/bar'}
              },
              additionalProperties: false
            },
            {
              type: 'array',
              items: [
                {$ref: '#/definitions/foo'},
                {$ref: '#/definitions/bar'}
              ],
              minItems: 2,
              additionalItems: false
            }
          ],
          errorMessage: 'will be replaced in each test'
        };
      });

      it('should replace errors for properties and items with custom error messages', function() {
        schema.errorMessage = {
          properties: {
            foo: 'data.foo should be an object with the integer property "baz" <= 2',
            bar: 'data.bar should be an array with at least one string item with length <= 3'
          },
          items: [
            'data[0] should be an object with the integer property "baz" <= 2',
            'data[1] should be an array with at least one string item with length <= 3'
          ]
        };

        testPropsAndItems();
      });

      it('should replace errors for properties and items with interpolated error messages', function() {
        schema.errorMessage = {
          properties: {
            foo: 'data.foo should be an object with the integer property "baz" <= 2, "baz" is ${/foo/baz}',
            bar: 'data.bar should be an array with at least one string item with length <= 3, "bar" is ${/bar}'
          },
          items: [
            'data[0] should be an object with the integer property "baz" <= 2, data[0].baz is ${/0/baz}',
            'data[1] should be an array with at least one string item with length <= 3, data[1] is ${/1}'
          ]
        };

        testPropsAndItems(tmpl);

        function tmpl(str, data) {
          return str.replace('${/foo/baz}', JSON.stringify(data.foo && data.foo.baz))
                    .replace('${/bar}', JSON.stringify(data.bar))
                    .replace('${/0/baz}', JSON.stringify(data[0] && data[0].baz))
                    .replace('${/1}', JSON.stringify(data[1]));
        }
      });

      function testPropsAndItems(tmpl) {
        var validData1 = {
          foo: {baz: 1},
          bar: ['abc']
        };

        var validData2 = [
          {baz: 1},
          ['abc']
        ];

        ajvs.forEach(function (ajv) {
          validate = ajv.compile(schema);

          assert.strictEqual(validate(validData1), true);
          assert.strictEqual(validate(validData2), true);
          testInvalid({},                 ['required', 'required', 'type', 'anyOf'], tmpl);
          testInvalid({foo: 1},           ['required', 'type', 'anyOf', ['type']], tmpl);
          testInvalid({foo: 1, bar: 2},   ['type', 'anyOf', ['type'], ['type']], tmpl);
          testInvalid({foo: {baz: 'a'}},  ['required', 'type', 'anyOf', ['type']], tmpl);
          testInvalid({foo: {baz: 3}},    ['required', 'type', 'anyOf', ['maximum']], tmpl);
          testInvalid({foo: {baz: 3}, bar: []},       ['type', 'anyOf', ['maximum'], ['minItems']], tmpl);
          testInvalid({foo: {baz: 3}, bar: [1]},      ['type', 'anyOf', ['maximum'], ['type']], tmpl);
          testInvalid({foo: {baz: 3}, bar: ['abcd']}, ['type', 'anyOf', ['maximum'], ['maxLength']], tmpl);

          testInvalid([],            ['type', 'minItems', 'anyOf'], tmpl);
          testInvalid([1],           ['type', 'minItems', 'anyOf', ['type']], tmpl);
          testInvalid([1, 2],        ['type', 'anyOf', ['type'], ['type']], tmpl);
          testInvalid([{baz: 'a'}],  ['type', 'minItems', 'anyOf', ['type']], tmpl);
          testInvalid([{baz: 3}],    ['type', 'minItems', 'anyOf', ['maximum']], tmpl);
          testInvalid([{baz: 3}, []],       ['type', 'anyOf', ['maximum'], ['minItems']], tmpl);
          testInvalid([{baz: 3}, [1]],      ['type', 'anyOf', ['maximum'], ['type']], tmpl);
          testInvalid([{baz: 3}, ['abcd']], ['type', 'anyOf', ['maximum'], ['maxLength']], tmpl);
        });
      }
    });


    function testInvalid(data, expectedErrors, interpolate) {
      assert.strictEqual(validate(data), false);
      assert.strictEqual(validate.errors.length, expectedErrors.length);
      validate.errors.forEach(function (err, i) {
        var expectedErr = expectedErrors[i];
        if (Array.isArray(expectedErr)) { // errorMessage error
          assert.strictEqual(err.keyword, 'errorMessage');
          var child = Array.isArray(data) ? 'items' : 'properties';
          var expectedMessage = schema.errorMessage[child][err.dataPath.slice(1)];
          if (interpolate) expectedMessage = interpolate(expectedMessage, data);
          assert.strictEqual(err.message, expectedMessage);
          assert((Array.isArray(data) ? /^\/(0|1)$/ : /^\/(foo|bar)$/).test(err.dataPath));
          assert.strictEqual(err.schemaPath, '#/errorMessage');
          var replacedKeywords = err.params.errors.map(function (e) {
            return e.keyword;
          });
          assert.deepEqual(replacedKeywords.sort(), expectedErr.sort());
        } else { // original error
          assert.strictEqual(err.keyword, expectedErr);
        }
      });
    }
  });

  describe('default message', function() {
    it('should replace all errors not replaced by keyword/properties/items messages', function() {
      var schema = {
        type: 'object',
        required: ['foo', 'bar'],
        properties: {
          foo: { type: 'integer' },
          bar: { type: 'string' }
        },
        errorMessage: {
          properties: {
            foo: 'data.foo should be integer',
            bar: 'data.bar should be integer'
          },
          required: 'properties foo and bar are required',
          _: 'should be an object with properties "foo" (integer) and "bar" (string)'
        }
      };

      ajvs.forEach(function (ajv) {
        var validate = ajv.compile(schema);

        assert.strictEqual(validate({foo: 1, bar: 'a'}), true);
        testInvalid({foo: 1}, [['required']]);
        testInvalid({foo: 'a'}, [['required'], ['type']]);
        testInvalid(null, [['type']]);

        function testInvalid(data, expectedErrors) {
          assert.strictEqual(validate(data), false);
          assert.strictEqual(validate.errors.length, expectedErrors.length);
          validate.errors.forEach(function (err, i) {
            var expectedErr = expectedErrors[i];
            if (Array.isArray(expectedErr)) { // errorMessage error
              assert.equal(err.keyword, 'errorMessage');
              assert.equal(err.schemaPath, '#/errorMessage');
              var expectedMessage = err.dataPath
                                    ? schema.errorMessage.properties.foo
                                    : schema.errorMessage[expectedErr[0] == 'required' ? 'required' : '_'];
              assert.equal(err.message, expectedMessage);
              var replacedKeywords = err.params.errors.map(function (e) {
                return e.keyword;
              });
              assert.deepEqual(replacedKeywords.sort(), expectedErr.sort());
            } else { // original error
              assert.strictEqual(err.keyword, expectedErr);
            }
          });
        }
      });
    });
  });
});
