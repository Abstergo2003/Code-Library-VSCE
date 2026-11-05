const assert = require('assert');
const { getFunctionsAsObjects } = require('../extension');

suite('Code Library parser', () => {
    test('ignores function-like text in comments and strings', () => {
        const source = `// function fake() { return 1; }
function real() {
    const text = "function nested() { return 2; }";
    /* function alsoFake() {} */
    return text;
}
function second() { return 3; }`;

        const result = getFunctionsAsObjects(source, 'javascript');

        assert.deepStrictEqual(result.map(item => item.name), ['real', 'second']);
        assert.ok(result[0].text.includes('function real()'));
    });

    test('preserves Python decorators and nested blocks', () => {
        const source = `@decorator
def first(value):
    if value:
        return {"text": "def fake():"}
    return None

def second():
    return 2`;

        const result = getFunctionsAsObjects(source, 'python');

        assert.deepStrictEqual(result.map(item => item.name), ['first', 'second']);
        assert.ok(result[0].text.startsWith('@decorator\ndef first'));
        assert.ok(result[0].text.includes('return {"text": "def fake():"}'));
    });

    test('handles semicolons inside SQL strings', () => {
        const source = `CREATE FUNCTION first()
RETURNS TEXT
BEGIN
    RETURN 'value;still-open';
END;

CREATE FUNCTION second()
RETURNS INT
BEGIN
    RETURN 2;
END;`;

        const result = getFunctionsAsObjects(source, 'sql');

        assert.deepStrictEqual(result.map(item => item.name), ['first', 'second']);
        assert.ok(result[0].text.includes("'value;still-open'"));
    });

    test('separates Makefile targets while retaining recipes', () => {
        const source = `build:
\t@echo "build"

test: build
\t@echo "test"`;

        const result = getFunctionsAsObjects(source, 'makefile');

        assert.deepStrictEqual(result.map(item => item.name), ['build', 'test']);
        assert.ok(result[0].text.includes('@echo "build"'));
        assert.ok(!result[0].text.includes('@echo "test"'));
    });

    test('extracts representative brace-based language functions', () => {
        const cases = [
            ['javascript', 'function javascriptExample(value) { return value; }', 'javascriptExample'],
            ['react', 'function reactExample(value) { return <div>{value}</div>; }', 'reactExample'],
            ['typescript', 'function typescriptExample(value: string) { return value; }', 'typescriptExample'],
            ['rust', 'fn rust_example(value: i32) -> i32 { value }', 'rust_example'],
            ['java', 'public static int javaExample(int value) { return value; }', 'javaExample'],
            ['cpp', 'int cppExample(int value) { return value; }', 'cppExample'],
            ['c', 'int cExample(int value) { return value; }', 'cExample'],
            ['php', 'function phpExample($value) { return $value; }', 'phpExample'],
            ['csharp', 'public static int csharpExample(int value) { return value; }', 'csharpExample'],
            ['kotlin', 'fun kotlinExample(value: Int): Int { return value }', 'kotlinExample'],
            ['swift', 'func swiftExample(_ value: Int) -> Int { return value }', 'swiftExample'],
            ['ruby', 'def ruby_example(value)\n  value\nend', 'ruby_example'],
            ['go', 'func goExample(value int) int { return value }', 'goExample'],
            ['dart', 'int dartExample(int value) { return value; }', 'dartExample']
        ];

        for (const [language, source, expectedName] of cases) {
            const result = getFunctionsAsObjects(source, language);
            assert.strictEqual(result.length, 1, `${language} should produce one item`);
            assert.strictEqual(result[0].name, expectedName, `${language} function name`);
            assert.ok(result[0].text.includes(source.split('\n')[0]), `${language} body should be retained`);
        }
    });

    test('extracts shell functions and Haskell definitions', () => {
        const shell = getFunctionsAsObjects(`build() {
    echo "build"
}

test() {
    echo "test"
}`, 'shellscript');
        assert.deepStrictEqual(shell.map(item => item.name), ['build', 'test']);
        assert.ok(shell[0].text.includes('echo "build"'));
        assert.ok(!shell[0].text.includes('echo "test"'));

        const haskell = getFunctionsAsObjects(`double x = x * 2
  where
    helper y = y + y

triple x = x * 3`, 'haskell');
        assert.deepStrictEqual(haskell.map(item => item.name), ['double', 'triple']);
        assert.ok(haskell[0].text.includes('helper y = y + y'));
        assert.ok(!haskell[0].text.includes('triple x'));
    });

    test('extracts database variants and falls back to plain text', () => {
        const sources = [
            ['sql', 'CREATE FUNCTION sqlFunction() RETURNS INT BEGIN RETURN 1; END;', 'sqlFunction'],
            ['mysql', 'CREATE PROCEDURE mysqlProcedure() BEGIN SELECT 1; END;', 'mysqlProcedure'],
            ['postgresql', 'CREATE OR REPLACE FUNCTION postgresFunction() RETURNS INT AS $$ SELECT 1; $$ LANGUAGE SQL;', 'postgresFunction']
        ];

        for (const [language, source, expectedName] of sources) {
            const result = getFunctionsAsObjects(source, language);
            assert.strictEqual(result[0].name, expectedName, `${language} name`);
            assert.strictEqual(result[0].text, source, `${language} statement should be retained`);
        }

        const plainText = 'This is not a parsed language.';
        assert.deepStrictEqual(getFunctionsAsObjects(plainText, 'markdown'), [{
            name: 'Plain Text',
            text: plainText
        }]);
    });

    test('extracts configuration and infrastructure targets', () => {
        const makefile = getFunctionsAsObjects(`build:
\t@echo build

clean:
\t@echo clean`, 'makefile');
        assert.deepStrictEqual(makefile.map(item => item.name), ['build', 'clean']);

        const unknownTerraform = getFunctionsAsObjects('resource "aws_instance" "example" {}', 'terraform');
        assert.deepStrictEqual(unknownTerraform, [{
            name: 'Plain Text',
            text: 'resource "aws_instance" "example" {}'
        }]);
    });
});
