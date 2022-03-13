import { Writer } from './writer';
import { Test, ITestFunction, TestEntry, ICheckEntry, cache, PASSED, FAILED } from './test'
import { Writable } from 'stream';
import { tool } from './tools';
import { InspectOptions } from 'util';

type RunnerArgument = (() => unknown | Promise<unknown>) | string;

export interface ITesterOptions {
	stdout?: Writable,
	tabLength?: number,
	verbosity?: number,
	inspectOptions?: InspectOptions
	timeOptions?: Intl.NumberFormatOptions
}

let stdout: Writable = process.stdout;
let write = Writer.write(stdout); //  out.log;



const runSelection = async (selection: [string, string][]) => {
	for (const selected of selection) {
		const [testerKey, pattern] = selected;
		const tester = cache[testerKey];
		if (tester === undefined) throw new Error(`${testerKey} tester do not exists.`)
		const tests = tester.tests;
		for (const testKey in tests) {
			const test = tests[testKey];
			if (pattern) {
				const rx = new RegExp(pattern);
				if (!rx.test(test.name)) continue;
			}
			await runTest(test);
		}
	}
}

const runTest = async (entry: TestEntry) => {
	const t = performance.now();
	const res = await Promise.resolve(entry.fn());
	entry.time = performance.now() - t;
	entry.result = (res === undefined || res === true) ? true : false;
	entry.faileds = 0;
	for (const check of entry.checks) if (!check.result) entry.faileds++;
	entry.result = entry.faileds === 0 && res !== false;
	entry.runned = true;
}



const sumarize = () => {
	let ret = '';
	let testerFailed = false;
	write('-'.repeat(80));

	let ac = 0;
	for (const testerKey in cache) {
		const tester = cache[testerKey];
		ret = '';
		testerFailed = false;
		for (const testKey in tester.tests) {
			const test = tester.tests[testKey]
			if (test.runned) {
				const titleTest = `${test.result ? PASSED : FAILED} Test ${testKey}`;
				testerFailed ||= (!test.result);
				ac += test.faileds;
				if (Writer.isInfoLevel()) {
					ret += testInfoSumary(titleTest, test);
				} else if (Writer.isWarnLevel()) {
					ret += testWarnSumary(titleTest, test)
				} else {
					ret += testLogSumary(titleTest, test);
				}
			}
		}
		// if (failed || Writer.isWarnLevel()) ret = `${ titleTester }: \n${ ret } `;
		const titleTester = `${testerFailed ? FAILED : PASSED} Tester ${testerKey}`;
		if (ret) {
			ret = `${titleTester}: \n${ret} `;
			write(ret);
		}
	}
	if (ac > 0) {
		write(`Total test faileds: ${ac} `)
	} else {
		write('No test faileds');
	}
	write('-'.repeat(80));
}

const checkSumary = (entries: ICheckEntry[]) => {
	let ret = '';
	for (let check of entries) {
		let msg = `${check.result ? PASSED : FAILED} ${check.name} ${check.message}`;
		if (check.result) {
			if (check.time) msg += `(in ${tool.timer(check.time)})`
			if (Writer.isInfoLevel()) ret += Writer.adapter(2, msg);
		} else {
			if (Writer.isWarnLevel()) ret += Writer.adapter(2, msg);
		}
	}
	return ret;
}

const testFailedSumary = (title: string, entry: TestEntry) => {
	let ret = `\t${title}\n`;
	if (entry.output) ret += testOutput(entry);
	ret += checkSumary(entry.checks);
	ret += `\n\tTotal checks failed: ${entry.faileds} \n`;
	return ret;
}

const testLogSumary = (title: string, entry: TestEntry) => {
	let ret: string;
	if (entry.result) {
		ret = '';
		if (entry.output) ret = testOutput(entry);
		if (ret) ret = `${title}: \n${ret} `;
	} else {
		ret = testFailedSumary(title, entry);
	}
	return ret;
}

const testWarnSumary = (title: string, entry: TestEntry) => {
	let ret: string;
	if (entry.result) {
		ret = `\t${title}(in ${tool.timer(entry.time)})\n`;
		if (entry.output) ret += testOutput(entry);
	} else {
		ret = testFailedSumary(title, entry);
	}
	return ret;
}

const testInfoSumary = (title: string, entry: TestEntry) => {
	let ret: string;
	if (entry.result) {
		ret = `\t${title}(in ${tool.timer(entry.time)})\n`;
		if (entry.output) ret += testOutput(entry);
		ret += checkSumary(entry.checks);
	} else {
		ret = testFailedSumary(title, entry);
	}
	return ret + '\n';
}

const testOutput = (entry: TestEntry) => {
	let ret = '.'.repeat(40);
	ret += '\n' + entry.output;
	ret += '.'.repeat(40);
	ret = Writer.adapter(1, ret);
	return ret;
}



const tester = (name: string) => {
	const tester = cache[name] ||= {
		name,
		tests: {}
	}
	return (name: string, fn: ITestFunction) => {
		return new Test(name, tester, fn)
	}
}

tester.config = (verbosity: number | ITesterOptions, options?: ITesterOptions) => {
	let opt: ITesterOptions = options === undefined ? {} : options
	if (typeof verbosity === 'number') {
		opt.verbosity = verbosity;
	} else {
		opt = verbosity;
	}
	Writer.tabLength = opt.tabLength || 2;
	stdout = opt.stdout || process.stdout;
	Writer.verbosity = opt.verbosity || 1;
	write = Writer.write(stdout);
	if (opt.inspectOptions) tool.inspectOptions = opt.inspectOptions;
	if (opt.timeOptions) tool.timeOptions = opt.timeOptions;
}

tester.run = async (...args: RunnerArgument[]) => {
	let keys: string[] = [];
	for (const arg of args) {
		if (typeof arg === 'function') {
			await Promise.resolve(arg());
		} else {
			keys.push(arg)
		}
	}
	if (keys.length === 0) keys = Object.keys(cache);
	const selection = keys.map(key => key.split('#') as [string, string]);
	await runSelection(selection);
	sumarize()
}

tester.VERBOSITY_INFO = Writer.INFO;
tester.VERBOSITY_WARN = Writer.WARN;
tester.VERBOSITY_NONE = Writer.LOG;

export default Object.freeze(tester);


