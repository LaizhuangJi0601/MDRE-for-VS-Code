import {setupLanguage,t} from './i18n/ui';
import './style.css';
import {invoke} from './platform';
import {loadSettings,settings} from './persistence/settings';
import {setupPreferences} from './ui/preferences';
import {setupMotion,applyMotion} from './ui/motion';
import {applyUiScale} from './ui/ui-scale';
await loadSettings();
setupLanguage();
function paint(){applyMotion();const value=settings();document.documentElement.dataset.theme=value.theme==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):value.theme;applyUiScale(value.ui_scale);}
paint();
const preferences=setupPreferences({open:dialog=>{if(!dialog.open)dialog.show();},close:dialog=>{if(dialog.id==='settings-dialog')void invoke('close_settings');else dialog.close();},applied:paint,fonts:mono=>mono?['Consolas','Cascadia Mono','monospace']:['Microsoft YaHei','Segoe UI','SimSun','KaiTi','sans-serif']});
document.getElementById('settings-open')!.click();
setupMotion();
