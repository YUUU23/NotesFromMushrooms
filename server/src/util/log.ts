function PERFLOG(str: String, args: any[]): void {
  const prefix = 'PERF|';
  console.log(prefix + str, ...args);
}

export { PERFLOG };
