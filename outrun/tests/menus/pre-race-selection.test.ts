import {worldTest,expect} from '@gameengine/test';
import {reducePreRace,MenuPage,MenuAction} from '../../src/sim/pre-race-selection.ts';
import type {PreRaceSelectionValue} from '../../src/schema.gen.ts';
worldTest('menus.pre-race carries recorded options, gears and car through radio; unavailable modes cannot start',()=>{
  let s:PreRaceSelectionValue={enabled:true,page:0,cursor:0,difficulty:1,population:20,manual:false,car:0,launch:false,held:0};
  const act=(action:number)=>{s=reducePreRace(s,action);};
  s=reducePreRace(s,MenuAction.Select,1);expect(s.cursor).toBe(1);act(MenuAction.Accept);act(MenuAction.Next);act(MenuAction.Down);act(MenuAction.Previous);act(MenuAction.Back);
  expect(s.difficulty).toBe(2);expect(s.population).toBe(9);
  act(MenuAction.Accept);act(MenuAction.Next);act(MenuAction.Accept);expect(s.page).toBe(MenuPage.Mode);
  act(MenuAction.Previous);act(MenuAction.Accept);act(MenuAction.Next);act(MenuAction.Accept);
  act(MenuAction.Next);act(MenuAction.Next);act(MenuAction.Accept);expect(s.page).toBe(MenuPage.Radio);
  act(MenuAction.Back);expect(s.car).toBe(2);expect(s.manual).toBe(true);
  act(MenuAction.Accept);act(MenuAction.Launch);
  expect(s.launch).toBe(true);expect(s.enabled).toBe(false);expect(s.page).toBe(MenuPage.Race);
  expect(s.difficulty).toBe(2);expect(s.population).toBe(9);expect(s.car).toBe(2);expect(s.manual).toBe(true);
});
