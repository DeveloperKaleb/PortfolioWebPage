const buttonSpace = document.querySelector(".butMania");
let one = true;
let colorOne = "white";
let two = true;
let colorTwo = "white";
let three = true;
let colorThree = "white";
let four = true;
let colorFour = "white";

function renderButtons() {
  buttonSpace.innerHTML = `
    <button class="butOne" style="color: ${colorOne}"></button>
    <button class="butTwo" style="color: ${colorTwo}"></button>
    <button class="butThree" style="color: ${colorThree}"></button>
    <button class="butFour" style="color: ${colorFour}"></button>
`;
}
renderButtons();

buttonSpace.addEventListener("click", (event) => {
  if (event.target.className === "butOne") {
    two = !two;
    console.log(two);
    two ? (colorTwo = "white") : (colorTwo = "black");
    console.log(colorTwo);
    renderButtons();
    console.log(buttonSpace);
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