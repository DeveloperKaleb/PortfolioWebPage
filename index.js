const buttonSpace = document.querySelector(".butMania");
let one = true;
let two = true;
let three = true;
let four = true;

let colorOne = "white";
let colorTwo = "white";
let colorThree = "white";
let colorFour = "white";

let buttonString = `
<button class="butOne" style="color: ${colorOne}"></button>
<button class="butTwo" style="color: ${colorTwo}"></button>
<button class="butThree" style="color: ${colorThree}"></button>
<button class="butFour" style="color: ${colorFour}"></button>
`;

function renderButtons() {
  buttonSpace.innerHTML = buttonString;
}
renderButtons();

buttonSpace.addEventListener("click", (event) => {
  if (event.target.className === "butOne") {
    two = !two;
    console.log(two);
    two ? (colorTwo = "white") : (colorTwo = "black");
    console.log(colorTwo);
    renderButtons();
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