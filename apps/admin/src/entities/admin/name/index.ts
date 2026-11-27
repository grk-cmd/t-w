export { useAdminNames } from './api/hooks';
export { syncMyAdminName } from './api/firebase';
export { useAdminNamePort, type AdminNamePort } from './api/index';
export {
  ADMIN_NAME_MAX,
  ADMIN_NAMES_ROOT,
  adminNameOf,
  adminNameWrite,
  adminOptions,
  cleanAdminName,
  shortUid,
  toAdminNames,
} from './model/adminName';
