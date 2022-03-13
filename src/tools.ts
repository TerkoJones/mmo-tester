import { InspectOptions, isDeepStrictEqual, inspect } from 'util';


const timeOptions: Intl.NumberFormatOptions = {
	compactDisplay: 'long',
	useGrouping: true,
	maximumFractionDigits: 6,

}

const inspectOptions: InspectOptions = {
	depth: 5
}

const stringify = (data: any) => {
	return inspect(data, tool.inspectOptions);
}

const errorChecker = <T extends { new(...args: any[]): unknown }>(err: Error, Err?: T) => {
	return !Err ? true : Object.getPrototypeOf(err).constructor === Err;
}

const equals = isDeepStrictEqual;

const timer = (num: number): string => {
	const fmtd = Intl.NumberFormat(undefined, tool.timeOptions).format(num);
	return `${fmtd}ms`;
}

export const tool = {
	timeOptions,
	inspectOptions,
	stringify,
	errorChecker,
	equals,
	timer
}
