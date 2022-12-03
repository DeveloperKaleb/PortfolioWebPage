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
  <button class="butOne" style="background-color: ${pOne}"></button>
  <button class="butTwo" style="background-color: ${pTwo}"></button>
  <button class="butThree" style="background-color: ${pThree}"></button>
  <button class="butFour" style="background-color: ${pFour}"></button>
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
  }
  if (event.target.className === "butThree") {
    two = !two;
    four = !four;
  }
  if (event.target.className === "butFour") {
    three = !three;
  }
});