#!/usr/bin/env node
import { loadEnvFile } from '../config/loadEnv.js';
loadEnvFile();
import { Command } from 'commander';
import { registerGenerateCommand } from './commands/generateScenarioCommand.js';
import { registerAnalyzeCommand } from './commands/analyzeProjectCommand.js';
import { registerAutoGenerateCommand } from './commands/autoGenerateScenarioCommand.js';
const program = new Command();
program
    .name('replica-generator')
    .description('Generates a new IDE-based coding assessment scenario from a base scenario and a transformation spec')
    .version('1.0.0');
registerGenerateCommand(program);
registerAnalyzeCommand(program);
registerAutoGenerateCommand(program);
program.parseAsync(process.argv).catch((error) => {
    console.error('Unhandled CLI error:', error);
    process.exitCode = 1;
});
