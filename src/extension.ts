// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { exec } from 'child_process';
import * as vscode from 'vscode';
import { WebSocket } from 'ws';

let websocketConnection: WebSocket | null = null;


const connectToWebSocket = (port: string) => {
	websocketConnection = new WebSocket(`ws://localhost:${port}`);

	websocketConnection.on('open', () => {
		console.log('Connected to WebSocket');
	});

	websocketConnection.on('message', (data) => {
		console.log('Received message:', data);
	});

	websocketConnection.on('close', () => {
		console.log('WebSocket connection closed');
		vscode.window.showErrorMessage('Reed (WebSocket) connection closed!');
	});

	websocketConnection.on('error', (error) => {
		console.error('WebSocket error:', error);
	});
};

const isConnected = () => {
	if (websocketConnection) {
		if (websocketConnection.readyState === WebSocket.OPEN) {
			return true;
		} else {
			return false;
		}
	} else {
		return false;
	}
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let extensionConfig = vscode.workspace.getConfiguration('renpy-live-viewer');

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('"renpy-live-viewer" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let connectCommand = vscode.commands.registerCommand('renpy-live-viewer.connect', () => {
		if (websocketConnection) {
			vscode.window.showInformationMessage(
				'Editor already connected to game.\nAre you sure you want to reconnect?',
				{ modal: true },
				'Reconnect'
			).then((value) => {
				if (value === 'Reconnect') {
					if (websocketConnection) {
						websocketConnection.close();
						websocketConnection = null;
					}
					vscode.window.showInputBox({
						placeHolder: 'Enter port number (default: 35124)...',
						prompt: 'Enter the reed (WebSocket) port of the RenPy game',
						value: '35124'
					}).then((value) => {
						if (value) {
							connectToWebSocket(value);
						}
					});
				}
			});
		} else {
			vscode.window.showInputBox({
				placeHolder: 'Enter port number (default: 35124)...',
				prompt: 'Enter the reed (WebSocket) port of the RenPy game',
				value: '35124'
			}).then((value) => {
				if (value) {
					connectToWebSocket(value);
				}
			});
		};
	});

	let disconnectCommand = vscode.commands.registerCommand('renpy-live-viewer.disconnect', () => {
		if (websocketConnection) {
			websocketConnection.close();
			websocketConnection = null;
			vscode.window.showInformationMessage('Reed (WebSocket) connection closed.');
		} else {
			vscode.window.showInformationMessage('No reed (WebSocket) to close.');
		}
	});

	let onSelectionChanged = vscode.window.onDidChangeTextEditorSelection((event) => {
		const selection = event.selections[0];
		if (selection && websocketConnection) {
			const changedFilename = event.textEditor.document.fileName;
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(changedFilename))?.uri.fsPath;
			if (workspaceFolder) {
				const filepath = changedFilename.replace(workspaceFolder, '').replace(/\\/g, '/').replace("/game/", "");
				const message = `renpy.warp_to_line("${filepath}:${selection.active.line + 1}")`;
				websocketConnection.send(message);
			}
		}
	});

	let jumpCommand = vscode.commands.registerCommand('renpy-live-viewer.jump', () => {
		if (isConnected()) {
			vscode.window.showInputBox({
				placeHolder: 'Enter label...',
				prompt: 'Enter the label to jump to'
			}).then((value) => {
				if (value) {
					if (websocketConnection) {
						const message = `renpy.call_in_new_context("${value}")`;
						websocketConnection.send(message);
					} else {
						vscode.window.showErrorMessage('Editor doesn\'t connected to reed (WebSocket).');
					}
				}
			});
		} else {
			vscode.window.showErrorMessage('Editor doesn\'t connected to reed (WebSocket).');
		}
	});

	let enterReedCommand = vscode.commands.registerCommand('renpy-live-viewer.reed-command', () => {
		if (isConnected()) {
			vscode.window.showInputBox({
				placeHolder: 'Enter command...',
				prompt: 'Enter the command to send to the game'
			}).then((value) => {
				if (value) {
					if (websocketConnection) {
						websocketConnection.send(value);
					} else {
						vscode.window.showErrorMessage('Editor doesn\'t connected to reed (WebSocket).');
					}
				}
			});
		} else {
			vscode.window.showErrorMessage('Editor doesn\'t connected to reed (WebSocket).');
		}
	});

	const startGameCommand = vscode.commands.registerCommand('renpy-live-viewer.start-game', () => {
		const executableSdkPath = extensionConfig.get<string>('sdk-executable');
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
		if (!executableSdkPath) {
			vscode.window.showInputBox({
				placeHolder: 'Enter SDK executable path...',
				prompt: 'Enter the path to the RenPy SDK executable'
			}).then((value) => {
				if (value) {
					extensionConfig.update('sdk-executable', value);
					const command = `"${executableSdkPath}" "${workspaceFolder}"`;
					const exec = require('child_process').exec;
					exec(command, (error: any, stdout: any, stderr: any) => {
						if (error) {
							console.error(`exec error: ${error}`);
							vscode.window.showErrorMessage(`Error starting game: ${error}`);
							return;
						}
						console.log(`stdout: ${stdout}`);
						console.error(`stderr: ${stderr}`);
					});
				}
			});
		} else if (workspaceFolder) {
			const command = `"${executableSdkPath}" "${workspaceFolder}"`;
			exec(command, (error: any, stdout: any, stderr: any) => {
				if (error) {
					console.error(`exec error: ${error}`);
					vscode.window.showErrorMessage(`Error starting game: ${error}`);
					return;
				}
				console.log(`stdout: ${stdout}`);
				console.error(`stderr: ${stderr}`);
			});
		} else {
			vscode.window.showErrorMessage('No workspace folder found.');
		}
	});

	context.subscriptions.push(connectCommand, disconnectCommand, onSelectionChanged, jumpCommand, enterReedCommand, startGameCommand);
}


export function deactivate() {
	if (websocketConnection) {
		websocketConnection.close();
		websocketConnection = null;
	}
	console.log('WebSocket connection closed');
}
