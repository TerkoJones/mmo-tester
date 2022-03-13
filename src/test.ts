import { Writer, ILogger } from './writer';
import { tool } from './tools';


type TestFunctionResult = boolean | void | Promise<boolean | void>;

export interface ITestFunction {
	(this: Test): TestFunctionResult
}

export interface ICheckEntry {
	name: string,
	result: boolean,
	message: string,
	time?: number
}

export interface TestEntry {
	name: string,
	testerName: string,
	time: number,
	result: boolean,
	faileds: number,
	checks: ICheckEntry[],
	measure: boolean,
	message: string,
	output: string,
	runned: boolean,
	fn: () => TestFunctionResult
}

type TesterEntry = {
	name: string,
	tests: Record<string, TestEntry>;
}

type TesterCache = Record<string, TesterEntry>;

export const PASSED = '\u2705';
export const FAILED = '\u274c';
export const cache: TesterCache = {};


export class Test {
	private _t: TestEntry;
	private _log: ILogger;

	constructor(name: string, entry: TesterEntry, fn: ITestFunction) {
		if (name in entry.tests) throw new Error(`Already exists ${name} test in ${entry.name}`);
		this._t = entry.tests[name] = {
			name,
			testerName: entry.name,
			result: false,
			faileds: 0,
			checks: [],
			time: 0,
			measure: true,
			message: '',
			output: '',
			runned: false,
			fn: fn.bind(this),
		}
		this._log = Writer.logger(this._t);
	}

	public get tester() { return this._t.testerName }
	public get log() { return this._log.log; }
	public get warn() { return this._log.warn; }
	public get info() { return this._log.info; }


	public equals(expected: unknown, received: unknown, name?: string) {
		const res = tool.equals(expected, received);
		this._addCheck(name || 'Equality', res,
			`failed\n\tExpected: ${tool.stringify(expected)}\n\tReceived: ${tool.stringify(received)}`);
		return res;
	}

	public expectedTrue(expr: any, name?: string) {
		const res = !!expr;
		this._addCheck(name || 'Espected true', res);
		return res;
	}

	public expectedFalse(expr: any, name?: string) {
		const res = !!expr;
		this._addCheck(name || 'Expected false', res);
		return res;
	}

	public partial<T>(expected: Partial<T>, received: T, name?: string) {
		let res = true;
		let msg = '';
		for (const k in expected) {
			if (!tool.equals(received[k], expected[k])) {
				res = false;
				msg += `\n\t'${k}': failed`;
			}
		}
		this._addCheck(name || 'Partial', res, msg);
		return res;
	}

	public async thrown<T extends { new(...args: any[]): unknown }>(fn: () => unknown, ErrConstructor?: T, name?: string) {
		name = name || fn.name ? `Error checking for ${fn.name}` : 'Error checking';
		let res = false;
		let received = 'none';
		let errName = ErrConstructor?.name || 'any';
		try {
			await Promise.resolve(fn());
		} catch (e: any) {
			res = tool.errorChecker(e, ErrConstructor);
			if (!res) received = e.constructor.name;
		}
		this._addCheck(name, res, `failed\n\texpected: ${errName}\n\treceived: ${received}`);
		return res;
	}

	public async exec(fn: () => boolean, name?: string) {
		name = name || `Extecuted ${fn.name || 'anonymous'}`;
		const t = performance.now();
		const res = await Promise.resolve(fn());
		this._addCheck(name, res).time = performance.now() - t;

		return res;
	}


	private _addCheck(name: string, result: boolean, failed?: string, passed?: string) {
		const ret: ICheckEntry = {
			name,
			result,
			message: result ? (passed || '') : (failed || '')
		}
		this._t.checks.push(ret);
		return ret;
	}


}
