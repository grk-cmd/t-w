export {
  applyReleaseFixes,
  checkTemplate,
  fillTemplate,
  fixNoticeBody,
  fixTargets,
  previewReleaseFixes,
  releasedReports,
  RELEASE_TPL_DEFAULT,
  RELEASE_TPL_MAX,
  tplVars,
  type ApplyOptions,
  type ApplyResult,
  type FixTarget,
  type ReleaseFix,
} from './model/applyRelease';
export { getReleaseTpl, RELEASE_TPL_PATH, releaseTplWrite, saveReleaseTpl } from './model/releaseTpl';
export { ApplyReleaseButton } from './ui/ApplyReleaseButton';
export { ReleaseTplPanel } from './ui/ReleaseTplPanel';
