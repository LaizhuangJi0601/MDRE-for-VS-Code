import {setupLanguage,t} from './i18n/ui';
import './style.css';
import {invoke} from './platform';
import {loadSettings,settings} from './persistence/settings';
import {setupPreferences,type PreferencesDraft} from './ui/preferences';
import {setupMotion,applyMotion} from './ui/motion';
await loadSettings();
setupLanguage();
function paint(){applyMotion();const value=settings();document.documentElement.dataset.theme=value.theme==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):value.theme;}
paint();
const preferences=setupPreferences({open:dialog=>{if(!dialog.open)dialog.show();},close:dialog=>{if(dialog.id==='settings-dialog')void invoke('close_settings');else dialog.close();},applied:paint,fonts:mono=>mono?['Consolas','Cascadia Mono','monospace']:['Microsoft YaHei','Segoe UI','SimSun','KaiTi','sans-serif'],draftChanged:draft=>invoke<void>('settings_draft',{draft})});
document.getElementById('settings-open')!.click();
const draft=await invoke<PreferencesDraft|null>('read_settings_draft');
if(draft && !draft.valid)preferences.restoreDraft(draft);
setupMotion();
