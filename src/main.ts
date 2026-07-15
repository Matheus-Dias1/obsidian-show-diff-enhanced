import {
	FileSystemAdapter,
	parseYaml,
	Plugin,
	sanitizeHTMLToDom,
} from "obsidian";
import { html, parse } from "diff2html";
import { createDailyDiffCodeBlock, gitDiff } from "./utils";
import fileText from "../icons/file-text.svg";
import filePlus from "../icons/file-plus.svg";
import fileDiff from "../icons/file-diff.svg";
import fileRenamed from "../icons/file-signature.svg";
import fileX from "../icons/file-x.svg";
import plus from "../icons/plus.svg";
import diff from "../icons/diff.svg";
import trash from "../icons/trash-2.svg";

const rawTemplates = {
	"icon-file": fileText,
	"icon-file-added": filePlus,
	"icon-file-changed": fileDiff,
	"icon-file-deleted": fileX,
	"icon-file-renamed": fileRenamed,
	"tag-file-added": plus,
	"tag-file-changed": diff,
	"tag-file-deleted": trash,
	"tag-file-renamed": fileRenamed,
};

export default class RenderDiffPlugin extends Plugin {
	async onload() {
		this.registerMarkdownCodeBlockProcessor(
			"show-diff",
			this.diffProcessor
		);

		this.addCommand({
			id: "generate-diff-for-today",
			name: "Generate diff code block for today",
			editorCallback: (editor) => {
				editor.replaceSelection(createDailyDiffCodeBlock());
			},
		});
	}

	onunload() {}

	private getVaultPath() {
		return (this.app.vault.adapter as FileSystemAdapter).getBasePath();
	}

	diffProcessor = async (rawConfig: string, el: HTMLDivElement) => {
		try {
			const config = {
				path: this.getVaultPath(),
				...parseYaml(rawConfig),
			};

			const diff = await gitDiff(config);

			if (!diff.trim()) {
				el.createEl("p", { text: "No changes" });
			}

			const fragment = sanitizeHTMLToDom(
				html(parse(diff), {
					drawFileList: false,
					matching: "lines",
					outputFormat: "side-by-side",
					rawTemplates,
				})
			);

			fragment.querySelectorAll<HTMLElement>(".d2h-file-wrapper").forEach((file) => {
				const header = file.querySelector<HTMLElement>(".d2h-file-header");
				const content = file.querySelector<HTMLElement>(".d2h-file-diff");
				if (!header || !content) return;

				const chevron = document.createElement("span");
				chevron.className = "show-diff-enhanced-chevron";
				chevron.setAttribute("aria-hidden", "true");
				header.prepend(chevron);

				header.classList.add("show-diff-enhanced-toggle");
				header.setAttribute("role", "button");
				header.setAttribute("tabindex", "0");
				header.setAttribute("aria-expanded", "false");
				content.hidden = true;

				const toggle = () => {
					const expanded = header.getAttribute("aria-expanded") === "true";
					const nextExpanded = !expanded;
					header.setAttribute("aria-expanded", String(nextExpanded));
					content.hidden = !nextExpanded;
				};

				header.addEventListener("click", toggle);
				header.addEventListener("keydown", (event) => {
					if (event.key !== "Enter" && event.key !== " ") return;
					event.preventDefault();
					toggle();
				});
			});

			el.append(fragment);
		} catch (e) {
			el.createEl("pre", { text: e });
		}
	};
}
