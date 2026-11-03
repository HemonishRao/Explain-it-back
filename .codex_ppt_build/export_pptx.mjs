import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const workspaceDir = process.cwd();
const skillDir = 'C:/Users/hemon/.codex/plugins/cache/openai-primary-runtime/presentations/26.1025.11240/skills/presentations';
const stagingDir = path.join(workspaceDir, '.codex_ppt_build');
const finalPath = path.join(workspaceDir, 'deliverables', 'Explain It Back Project Demo for Professor.pptx');
const candidatePath = path.join(stagingDir, 'candidate-professor.pptx');
const receiptPath = path.join(stagingDir, 'validation-professor.json');
const expectedSlideSizeEmu = '12192000,6858000';

const proto = JSON.parse(await fs.readFile(path.join(stagingDir, 'presentation.proto.json'), 'utf8'));
const presentation = Presentation.load(proto);
const deck = await PresentationFile.exportPptx(presentation);
await deck.save(candidatePath);

const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, 'container_tools/artifact_tool_utils.mjs')).href);
const result = await finalizePresentation({
  explicitTotalSlideCount: 8,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  tableArithmeticContracts: [],
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: 'C:/Users/hemon/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',
  integrityValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', expectedSlideSizeEmu, '--validate-bullet-geometry', '--validate-heading-fit'],
  fontPolicy: { basis: 'design', families: ['Aptos'] },
  verifyArtifactToolImport: true,
  receiptPath,
});
console.log(JSON.stringify(result));
