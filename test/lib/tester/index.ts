/**
 * @module tester
 * @version 1.0.0
 */
import { fail } from 'assert';
import { Writable } from 'stream';
import { text } from 'stream/consumers';
import { InspectOptions, isDeepStrictEqual } from 'util';
import { writer } from './writer';
import { inspect } from 'util';

interface CheckEntry {
	name: string,
	result: boolean,
	message: string
}


export interface TestFunction {
	(this: TestContext): boolean | void | Promise<boolean | void>
}

interface TestMaker {
	(name: string, fn: TestFunction): void,
	measure: (name: string, iterations: number, fn: (...args: any[]) => unknown, ...args: any[]) => void
}


const _out = writer();
const _cache: Record<string, Test[]> = {};


const _timeOptions: Intl.NumberFormatOptions = {
	compactDisplay: 'long',
	useGrouping: true,
	minimumFractionDigits: 4,
}

const _inspectOptions: InspectOptions = {
	depth: 5
}

const _stringify = (data: any) => {
	return inspect(data, _inspectOptions);
}

let _errorChecker = <T extends { new(...args: any[]): unknown }>(err: Error, Err: T) => {
	return Object.getPrototypeOf(err).constructor === Err;
}

let _equals = isDeepStrictEqual;
let _timer = (num: number): string => {
	const fmtd = Intl.NumberFormat(undefined, _timeOptions).format(num);
	return fmtd + ' ms'
}

export class TestContext {

	public readonly info = _out.info;
	public readonly warn = _out.warn;
	public readonly write = _out.write;
	public readonly group = _out.group;
	public readonly ungroup = _out.ungroup;
	private _info: Test

	constructor(test: Test) {
		this._info = test;

	}

	public get message() {
		return this._info.message;
	}
	public set message(message: string | undefined) {
		this._info.message = message;
	}

	public equals<T>(a: T, b: T, name?: string) {
		const res = _equals(a, b);
		this._info.addCheck(name || 'Equality', res);
		return res;
	}

	public expected(expected: unknown, received: unknown, name?: string) {
		const res = _equals(expected, received);
		this._info.addCheck(name || 'Expected', res, `failed\n\tExpected: ${_stringify(expected)}\n\tReceived: ${_stringify(received)}`);
		return res;
	}

	public trueCheck(expr: any, name?: string) {
		const res = !!expr;
		this._info.addCheck(name || 'Veritable', res);
		return res;
	}

	public partialEquality<T>(target: T, match: Partial<T>, name?: string) {
		let res = true;
		let msg = '';
		for (const k in match) {
			if (!_equals(target[k], match[k])) {
				res = false;
				msg += `\n\t- ${k} failed`;
			}
		}
		this._info.addCheck(name || 'Partial', res, msg);
		return res;
	}


	public exec(fn: () => boolean, name?: string) {
		name = name || (fn.name ? `${fn.name} execution` : 'Execution');
		const res = fn();
		this._info.addCheck(name, res);
		return res;
	}


	public async thrown<T extends { new(...args: any[]): unknown }>(fn: () => unknown, Err?: T, name?: string) {
		name = name || fn.name ? `Error checking for ${fn.name}` : 'Error checking';
		let res = false;
		let received = 'none';
		let errName = 'any';
		try {
			await Promise.resolve(fn());
		} catch (e: any) {
			if (Err === undefined) {
				res = true;
			} else {
				errName = Err.name;
				res = _errorChecker(e, Err!);
			}
			if (!res) received = e.constructor.name;
		}
		this._info.addCheck(name, res, `failed\n\texpected: ${errName}\n\treceived: ${received}`);
		return res;
	}

}


export class Test {
	public readonly name: string;
	public result: boolean = false; // resultado de la funcion
	public time: number = 0;
	public message?: string;
	public faileds: number = 0;
	public measure: boolean = true;
	private _checks: CheckEntry[] = [];
	private _fn: TestFunction;
	private _ctx: TestContext;
	private _runned: boolean = false;

	constructor(name: string, fn: TestFunction) {
		this.name = name;
		this._fn = fn;
		this._ctx = new TestContext(this);
	}

	public async run() {
		if (!this._runned) {
			const t = performance.now();
			const res = await Promise.resolve(this._fn.call(this._ctx));
			this.time = performance.now() - t;
			this.result = (res === undefined || res === true) ? true : false;
			this.faileds = 0;
			for (const check of this._checks) if (!check.result) this.faileds++;
		}
		this._runned = true;
		this._sumarize();
	}

	public addCheck(name: string, result: boolean, failed?: string, passed?: string) {
		this._checks.push({
			name,
			result,
			message: result ? (passed || 'passed') : (failed || 'failed')
		})
	}

	private _checksSumary() {
		for (let check of this._checks) {
			const msg = `- ${check.name}: ${check.message}`;
			if (check.result) {
				_out.info(msg);
			} else {
				_out.warn(msg);
			}
		}
	}

	public _sumarize() {
		const passed = this.result && (this.faileds === 0);
		const details = !passed || _out.verbosity() > 0;
		let time = this.measure ? `in ${_timer(this.time)}` : '';
		let tagline = passed ? `${this.message || 'passed'} ${time}` : 'failed';
		let header = `- ${this.name}:`;
		if (details) {
			if (passed) {
				if (_out.verbosity() === 1) {
					_out.write(`${header} ${tagline}`);
				} else {
					_out.group(`${header} ${tagline}`);
					this._checksSumary();
					_out.ungroup()
				}
			} else {
				let footer = ''
				if (this.faileds > 0) footer += `Failed checks: ${this.faileds}. `
				if (!this.result) footer += `Test failed.`;
				if (_out.verbosity() === 0) {
					_out.write(`${header} ... ${footer}`)
				} else {
					_out.group(`${header} ${tagline}...`);
					this._checksSumary();
					_out.write(`...${this.name}: ${footer}`);
					_out.ungroup();
				}
			}
		} else {
			_out.write(`${header} ${tagline}`)
		}
	}

}

const _testExists = (name: string, tests: Test[]) => {
	name = name.toLowerCase();
	for (const test of tests) if (test.name.toLowerCase() === name) return true;
	return false;
}

const tester = (name: string): TestMaker => {
	const cache = _cache[name] ||= [];
	const test = (name: string, fn: TestFunction) => {
		if (_testExists(name, cache)) throw new Error(`${name} test already exists in ${name}.`);
		cache.push(new Test(name, fn));
	}
	test.measure = async (name: string, iterations: number, fn: (...args: any[]) => unknown, ...args: any[]) => {
		if (_testExists(name, cache)) throw new Error(`${name} test already exists in ${name}.`);
		let t = performance.now();
		for (let i = 0; i < iterations; i++) await Promise.resolve(fn(...args));
		t = performance.now() - t;
		const tf: TestFunction = () => true;
		const entry = new Test(name, tf);
		cache.push(entry);
		entry.message = `${iterations} iterations(${_timer(t / iterations)}/iter) in ${_timer(t)}`;
		entry.measure = false;
	}


	return test;
}

type RunnerArgument = (() => unknown | Promise<unknown>) | string;

const run = async (...args: RunnerArgument[]) => {
	let keys: string[] = [];
	for (const arg of args) {
		if (typeof arg === 'function') {
			await Promise.resolve(arg());
		} else {
			keys.push(arg)
		}
	}
	if (keys.length === 0) keys = Object.keys(_cache);
	_out.write('\n\n' + '-'.repeat(40) + '\n')
	_out.write('Sumary:\n');
	await _sumarize(keys);
	_out.write('\n', '-'.repeat(40))
}

const _sumarize = async (keys: string[]) => {
	const selection = keys.map(key => {
		const [tester, pattern] = key.split('.');
		return {
			tester,
			pattern
		}
	})

	for (const selected of selection) {
		const { tester, pattern } = selected;
		const cache = _cache[tester];
		_out.write.group(tester)
		if (cache === undefined) throw new Error(`${tester} tester has not created.`)
		for (const test of cache) {
			if (pattern) {
				const rx = new RegExp(pattern);
				if (!rx.test(test.name)) continue;
			}
			await test.run();
		}
		_out.ungroup()
	}
}


Object.defineProperties(tester, {
	verbosity: {
		get: () => _out.verbosity(),
		set: (level: number) => _out.verbosity(level),
		configurable: false
	},
	equalityComparer: {
		get: () => _equals,
		set: (fn) => _equals = fn,
		configurable: false
	},
	errorChecker: {
		get: () => _errorChecker,
		set: (fn) => _errorChecker = fn,
		configurable: false
	},
	timeFormatter: {
		get: () => _timer,
		set: (fn) => _timer = fn,
		configurable: false
	},
	run: {
		value: run,
		writable: false,
		configurable: false
	},
	stdout: {
		get: () => _out.stdout(),
		set: (val) => _out.stdout(val),
		configurable: false
	},
	stderr: {
		get: () => _out.stderr(),
		set: (val) => _out.stderr(val),
		configurable: false
	},
	write: {
		value: _out.write,
		writable: false
	},
	warn: {
		value: _out.warn,
		writable: false
	},
	info: {
		value: _out.info,
		writable: false
	},
	error: {
		value: _out.error,
		writable: false
	}
})

export default tester as {
	(name: string): TestMaker,
	verbosity: number,
	equalityComparer: typeof _equals,
	errorChecker: typeof _errorChecker;
	timeFormatter: typeof _timer;
	run: typeof run,
	stdout: Writable,
	stderr: Writable,
	readonly write: typeof _out.write,
	readonly warn: typeof _out.warn,
	readonly info: typeof _out.info,
	readonly error: typeof _out.error,

}
