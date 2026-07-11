import { readFile, writeFile } from "node:fs/promises";

const [tag, output] = process.argv.slice(2);
if (!tag || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
	throw new Error("Usage: node scripts/extract-release-notes.mjs vX.Y.Z [output-file]");
}
const version = tag.slice(1);
const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const heading = changelog.match(new RegExp(`^## ${escaped} - \\d{4}-\\d{2}-\\d{2}\\r?$`, "m"));
if (!heading || heading.index === undefined) throw new Error(`No changelog section found for ${version}`);
const bodyStart = heading.index + heading[0].length;
const remainder = changelog.slice(bodyStart).replace(/^\r?\n/, "");
const nextHeading = remainder.search(/^## /m);
const notes = (nextHeading < 0 ? remainder : remainder.slice(0, nextHeading)).trim() + "\n";
if (!notes.trim()) throw new Error(`Changelog section for ${version} is empty`);
if (output) await writeFile(output, notes, "utf8");
else process.stdout.write(notes);
