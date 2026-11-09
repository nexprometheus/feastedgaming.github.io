import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('// Pokémon trivia:');
const end=html.indexOf('</script>',start);
assert.ok(start>0 && end>start,'Trivia script exists');
assert.match(html,/\[hidden\]\s*\{\s*display:\s*none\s*!important/,'Hidden quiz controls must override button display styles');
function node(){return{children:[],style:{},handlers:{},textContent:'',hidden:false,classList:{add(){}},addEventListener(name,fn){this.handlers[name]=fn;},append(child){this.children.push(child);},replaceChildren(){this.children=[];},removeAttribute(name){delete this[name];}};}
const ids=['pokemonTrivia','triviaPokemonImage','triviaQuestion','triviaAnswers','triviaFeedback','triviaQuestionCount','triviaScore','triviaProgress','triviaStart','triviaNext'];
function playback(seed){
 const nodes=Object.fromEntries(ids.map(id=>[id,node()]));
 const randomMath=Object.create(Math);
 randomMath.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 vm.runInNewContext(html.slice(start,end),{Math:randomMath,document:{getElementById:id=>nodes[id],createElement:node}});
 nodes.triviaStart.handlers.click();
 assert.equal(nodes.triviaStart.hidden,true);
 const questions=[];
 for(let index=0;index<20;index++){
  assert.equal(nodes.triviaQuestionCount.textContent,`Question ${index+1} of 20`);
  assert.equal(nodes.triviaNext.hidden,true);
  assert.equal(nodes.triviaAnswers.children.length,4);
  assert.equal(nodes.triviaPokemonImage.hidden,false);
  questions.push(nodes.triviaQuestion.textContent);
  const question=nodes.triviaQuestion.textContent;
  nodes.triviaNext.handlers.click();
  assert.equal(nodes.triviaQuestion.textContent,question,'Cannot advance before answering');
  nodes.triviaAnswers.children[0].handlers.click();
  const score=nodes.triviaScore.textContent;
  nodes.triviaAnswers.children[1].handlers.click();
  assert.equal(nodes.triviaScore.textContent,score,'Cannot score twice on one question');
  assert.ok(nodes.triviaAnswers.children.every(button=>button.disabled));
  assert.equal(nodes.triviaNext.hidden,false);
  nodes.triviaNext.handlers.click();
 }
 assert.equal(new Set(questions).size,20,'No repeated questions');
 assert.equal(nodes.triviaQuestionCount.textContent,'Quiz complete');
 assert.equal(nodes.triviaProgress.style.width,'100%');
 assert.equal(nodes.triviaNext.hidden,true);
 assert.equal(nodes.triviaPokemonImage.hidden,true);
 assert.match(nodes.triviaFeedback.textContent,/\d+ \/ 20 correct/);
 assert.equal(nodes.triviaStart.textContent,'Play Again');
 nodes.triviaStart.handlers.click();
 assert.equal(nodes.triviaScore.textContent,0);
 assert.equal(nodes.triviaQuestionCount.textContent,'Question 1 of 20');
 return questions;
}
assert.notDeepEqual(playback(1),playback(2),'Quiz order changes between randomized rounds');
console.log('PASS: two complete randomized 20-question quiz rounds, scoring guards, hidden controls, results and replay.');
