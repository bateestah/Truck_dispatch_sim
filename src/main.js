import './map.js';
import { UI, Game } from './ui_game.js';

window.UI = UI;
window.Game = Game;

UI.init();
Game.init();

const devBtn=document.getElementById('btnDevTools');
const drawbar=document.getElementById('drawbar');
if(devBtn && drawbar){
  devBtn.addEventListener('click',()=>{
    const show=drawbar.style.display==='none';
    drawbar.style.display=show?'flex':'none';
    devBtn.textContent=show?'Hide Dev Tools':'Show Dev Tools';
  });
}
