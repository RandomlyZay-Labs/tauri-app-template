import fs from 'node:fs';
import semanticRelease from 'semantic-release';

async function run() {
	try {
		const result = await semanticRelease({ dryRun: true });

		if (result) {
			const { nextRelease } = result;
			console.log(`Next release version determined: ${nextRelease.version}`);

			// Append the version to the GitHub Actions output variables file
			if (process.env.GITHUB_OUTPUT) {
				fs.appendFileSync(
					process.env.GITHUB_OUTPUT,
					`version=${nextRelease.version}\n`,
				);
				fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_release=true\n`);
			}
		} else {
			console.log(
				'No release is required (e.g. no relevant commits or chore/docs commits).',
			);
			if (process.env.GITHUB_OUTPUT) {
				fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=\n`);
				fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_release=false\n`);
			}
		}
	} catch (error) {
		console.error(
			'Failed to determine next release version programmatically:',
			error,
		);
		process.exit(1);
	}
}

void run();
