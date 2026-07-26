import fs from "node:fs";
import { config, resolveSkillFile } from "../config.js";

export function loadJobFitPrompt(): string {
  const skill = readRequiredFile(resolveSkillFile(config.skill.skillFile), "skill instructions");
  const profile = readRequiredFile(resolveSkillFile(config.skill.profileFile), "candidate profile");
  const resume = readRequiredFile(resolveSkillFile(config.skill.resumeFile), "candidate resume");

  return [
    "# Job Fit Analyzer Skill",
    skill,
    "# Candidate Profile",
    profile,
    "# Candidate Resume",
    resume
  ].join("\n\n");
}

function readRequiredFile(filePath: string, label: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}
