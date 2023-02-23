function myOnClickFunction() {
    console.log('javascript is running!');
    let myElement = document.querySelector("#message");
    myElement.innerText = 'changed';
    myElement.style.backgroundColor = 'gray';
}