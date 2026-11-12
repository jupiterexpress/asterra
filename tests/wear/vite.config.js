import {mergeConfig} from 'vite';
import base from '../../vite.config.js';
// A stable dev fixture server: evidence PNG writes must not reload an in-flight check.
export default mergeConfig(base,{server:{port:4195,hmr:false,watch:{ignored:['**/docs/**','**/tests/**']}}});
