const buttonSpace = document.querySelector(".butMania");
let one = true;
let two = true;
let three = true;
let four = true;

let colorOne = "white";
let colorTwo = "white";
let colorThree = "white";
let colorFour = "white";

function renderButtons(pOne = colorOne, pTwo = colorTwo, pThree = colorThree, pFour = colorFour) {
  buttonSpace.innerHTML = `
  <div>
    <button class="butOneRowOne" style="background-color: ${pOne}"></button>
    <button class="butTwoRowOne" style="background-color: ${pTwo}"></button>
    <button class="butThreeRowOne" style="background-color: ${pThree}"></button>
    <button class="butFourRowOne" style="background-color: ${pFour}"></button>
  </div>
  <div>
    <button class="butOneRowTwo" style="background-color: ${pOne}"></button>
    <button class="butTwoRowTwo" style="background-color: ${pTwo}"></button>
    <button class="butThreeRowTwo" style="background-color: ${pThree}"></button>
    <button class="butFourRowTwo" style="background-color: ${pFour}"></button>
  </div>
  `;
}
renderButtons();

buttonSpace.addEventListener("click", (event) => {
  if (event.target.className === "butOne") {
    two = !two;
    two ? (colorTwo = "white") : (colorTwo = "black");
    renderButtons(colorOne, colorTwo);
  }
  if (event.target.className === "butTwo") {
    one = !one;
    three = !three;
    one ? (colorOne = 'white') : (colorOne = 'black');
    three ? (colorThree = 'white') : (colorThree = 'black');
    renderButtons(colorOne, colorTwo, colorThree);
  }
  if (event.target.className === "butThree") {
    two = !two;
    four = !four;
    two ? (colorTwo = "white") : (colorTwo = "black");
    four ? (colorFour = 'white') : (colorFour = 'black');
    renderButtons(colorOne, colorTwo, colorThree, colorFour);
  }
  if (event.target.className === "butFour") {
    three = !three;
    three ? (colorThree = 'white') : (colorThree = 'black');
    renderButtons(colorOne, colorTwo, colorThree);
  }
});