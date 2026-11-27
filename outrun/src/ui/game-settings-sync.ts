import {GameSettingsStore,type GameSettings} from '../content/game-settings.ts';
import {encodeGameSettings,MenuPage} from '../sim/pre-race-selection.ts';
interface MenuSettings extends GameSettings {enabled:boolean;page:number;launch:boolean;}
const same=(a:GameSettings,b:GameSettings)=>a.difficulty===b.difficulty&&a.population===b.population&&a.manual===b.manual&&a.car===b.car;
/** A UI owner reads storage once, records restoration, then saves user choices.
 * Never persist initial defaults while the recorded restore is still pending. */
export class GameSettingsSync {
  private started=false;
  private pending:GameSettings|null=null;
  constructor(private store:GameSettingsStore,private restore:(value:number)=>void){}
  observe(menu:MenuSettings):void {
    if(!this.started){
      if(!menu.enabled||menu.page!==MenuPage.Home)return;
      this.started=true;
      // A fresh install has no preference to restore over recorded/authored
      // menu choices. Adopt those choices instead of inventing a default save.
      if(!this.store.hasSavedSettings){this.store.save(menu);return;}
      const saved=this.store.current();
      if(!same(menu,saved)){this.pending=saved;this.restore(encodeGameSettings(saved));}
      return;
    }
    if(this.pending){
      if(same(menu,this.pending)||!menu.enabled||menu.page!==MenuPage.Home)this.pending=null;
      else return;
    }
    // Leaving the menu is not a reason to replace saved choices with scene
    // defaults. The launch snapshot retains the player's confirmed settings.
    if(menu.enabled||menu.launch)this.store.save({difficulty:menu.difficulty,population:menu.population,manual:menu.manual,car:menu.car});
  }
}
