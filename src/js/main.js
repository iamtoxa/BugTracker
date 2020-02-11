
const client = new Apollo.lib.ApolloClient({
  networkInterface: Apollo.lib.createNetworkInterface({
    uri: 'http://127.0.0.1:4000/graphql',
    transportBatching: true,
  }),
  connectToDevTools: true,
})

function ShowTickets(status = null){
  [...document.querySelector("#results").querySelectorAll('.card')].map(card => card.remove());

  if(status != null){
    [...document.querySelector("#status").querySelectorAll("*")].map(element => element.classList.remove('selected'));
    document.querySelector("#status").querySelector(`[name='${status}']`).classList.add('selected');
  }

  var filter = {
    project: document.querySelector("select[name='project']").value,
    priority: document.querySelector("select[name='priority']").value,
    severity: document.querySelector("select[name='severity']").value,
    status: document.querySelector("#status").querySelector(`.selected`).attributes.name.value,
  };


  const tickets_QUERY = Apollo.gql`
  query {
    tickets{
      ID
      _projectID
      name
      description
      priority
      severity
      createat
      status
      tester{
        login
      }
    }
  }`

  
  client.query({
    query: tickets_QUERY,
  })
    .then(data => {
        var tickets = data.data.tickets.slice().sort((a,b) => Number(b.ID) - Number(a.ID));
        var tickets_copy = tickets.slice();
        
        tickets_copy.forEach(ticket => {

          if (ticket.status != filter.status) {
            tickets.splice(tickets.indexOf(ticket), 1)
          } else if (filter.severity != "" && ticket.severity != filter.severity) {
            tickets.splice(tickets.indexOf(ticket), 1)
          } else if (filter.priority != "" && ticket.priority != filter.priority) {
            tickets.splice(tickets.indexOf(ticket), 1)
          } else if (filter.project != "" && ticket._projectID != filter.project) {
            tickets.splice(tickets.indexOf(ticket), 1)
          }
        })

        tickets.forEach(ticket => {
            RenderTicket(ticket)
        });

        return true;
    })
    .catch(error => console.error(error));
  
  
  function RenderTicket(ticket) {
    var temp = document.getElementsByTagName("template")[0];
    var clon = temp.content.cloneNode(true);
  
    clon.querySelector(".name").innerText = ticket.name;
    clon.querySelector(".description").innerText = ticket.description;
    clon.querySelector(".priority").innerText = ticket.priority;
    clon.querySelector(".severity").innerText = ticket.severity;
    clon.querySelector(".time").innerText = ticket.createat;
    clon.querySelector(".project").innerText = ticket.tester.login;
    
    document.querySelector("#results").appendChild(clon);
    var newnode = $(document.querySelector("#results").lastChild);

    newnode.on('click',()=>{
      window.open(`/ticket?id=${ticket.ID}`,'_self');
    });

    newnode.fadeOut(0).fadeIn(100);
  }
  
}

async function sendMessage(ticket){


  const addMessage_QUERY = Apollo.gql`
  mutation addMessage($token: String!, $ticketID: ID!, $content: String!) {
    addMessage(token:$token, ticketID:$ticketID, content:$content)
  }`


  client.mutate({
    mutation: addMessage_QUERY,
    variables: {
      token: Cookies.get('JWT_A').toString(),
      content: document.querySelector("[name='message_content']").value,
      ticketID: Number(ticket)
    }
  })
    .then(data => {
      console.log(data);
      
      location.reload();
    })
    .catch(error => console.error(error));
}

async function auth(form){
  var formData = new FormData(form);

  const auth_QUERY = Apollo.gql`
  query {
    getToken(login: "${formData.get('login')}", password: "${formData.get('password')}") {
      Refresh
      Access
      log
    }
  }`


  client.query({
    query: auth_QUERY,
  })
    .then(data => {
      console.log(data.data.getToken);
      Cookies.set('JWT_A', data.data.getToken.Access, { expires: 30, path: '/' })
      Cookies.set('JWT_R', data.data.getToken.Refresh, { expires: 30, path: '/' })

      if (data.data.getToken.Access != "") location.reload();
      else alert(data.data.getToken.log);
    })
    .catch(error => {
      console.error(error);
    });
}

function unauth(){
  const unauth_QUERY = Apollo.gql`
  mutation delToken($Refresh: String!) {
    deleteToken(refresh:$Refresh){
      status
      log
    }
  }`

  console.log(Cookies.get('JWT_R'));

  client.mutate({
    mutation: unauth_QUERY,
    variables: {
      Refresh: Cookies.get('JWT_R')
    }
  })
    .then(data => {
      console.log(data);
      Cookies.set('JWT_A', '', { expires: -1, path: '/' })
      Cookies.set('JWT_R', '', { expires: -1, path: '/' })
      location.reload();
    })
    .catch(error => console.error(error));
}

function addProject(form){
  var formData = new FormData(form);

  const addProject_QUERY = Apollo.gql`
  mutation addProject($token: String!, $name: String!, $shortname: String!) {
    addProject(token:$token, name:$name, shortname:$shortname){
      status
      log
    }
  }`


  client.mutate({
    mutation: addProject_QUERY,
    variables: {
      token: Cookies.get('JWT_A'),
      name: formData.get('name'),
      shortname: formData.get('shortname')
    }
  })
    .then(data => {
      console.log(data);
      
      location.reload();
    })
    .catch(error => console.error(error));
}

function addIssue(form){
  var formData = new FormData(form);

  console.log({
    token: Cookies.get('JWT_A').toString(),
    name: formData.get('title').toString(),
    severity: formData.get('severity').toString(),
    priority: formData.get('priority').toString(),
    description: formData.get('description').toString(),
    type: formData.get('type').toString(),
    id: Number(formData.get('project'))
  });

  const addTicket_QUERY = Apollo.gql`
  mutation addTicket($token: String!, $id: ID!, $name: String!, $severity: task_severity!, $priority: task_priority!, $description: String!, $type: task_types!) {
    addTicket(token:$token, name:$name, projectID:$id, severity: $severity, priority: $priority, description: $description, type:$type)
  }`


  client.mutate({
    mutation: addTicket_QUERY,
    variables: {
      token: Cookies.get('JWT_A').toString(),
      name: formData.get('title').toString(),
      severity: formData.get('severity').toString(),
      priority: formData.get('priority').toString(),
      description: formData.get('description').toString(),
      type: formData.get('type').toString(),
      id: Number(formData.get('project'))
    }
  })
    .then(data => {
      console.log(data);
      
      location.reload();
    })
    .catch(error => console.error(error));
}


function newissue() {
  var token_data = getPayload(Cookies.get('JWT_A'))
  if(token_data.position != "tester"){
    alert("Вы не тестер");
    return false;
  }

  var overlay = document.createElement('div');
  overlay.classList.add('overlay');
  overlay.onclick = (e)=>{
    if(e.toElement == overlay){
      overlay.remove()
    }
  }

  var overlay_body = parseHTML(`
    <form class='overlay-form' onsubmit="addIssue(this);return false">
      <select name='project' id='' _onload='list_projects(this)' required>
        <option value='' selected='' disabled='' hidden=''>Project</option>
        
      </select>
      
      <select name='type' id='type' required>
        <option value='' selected='' disabled='' hidden=''>Type</option>
        <option value='bug'>Bug</option>
        <option value='improvement'>Improvement</option>
        <option value='task'>Task</option>
      </select>


      <input type='text' name='title' placeholder='Ticket name' required>
      <textarea name='description' placeholder='Description' required></textarea>

      <select name='severity' id='severity' required>
        <option value='' selected='' disabled='' hidden=''>Severity</option>
        <option value='blocker'>Blocker</option>
        <option value='critical'>Critical</option>
        <option value='major'>Major</option>
        <option value='minor'>Minor</option>
        <option value='trivial'>Trivial</option>
      </select>

      <select name='priority' id='priority' required>
        <option value='' selected='' disabled='' hidden=''>Priority</option>
        <option value='high'>High</option>
        <option value='medium'>Medium</option>
        <option value='low'>Low</option>
      </select>
      

      <button style="max-width:300px;" class='btn-round btn__blue'>Add Issue</button>
    </form>
  `)
  overlay.appendChild(overlay_body)

  document.body.appendChild(overlay)


  overlay.querySelectorAll('*[_onload]').forEach(element => {
    evalInContext(element.attributes._onload.value, element)
  });
}


function newProject() {
  var token_data = getPayload(Cookies.get('JWT_A'))
  if(token_data.position != "developer"){
    alert("Вы не разработчик");
    return false;
  }

  var overlay = document.createElement('div');
  overlay.classList.add('overlay');
  overlay.onclick = (e)=>{
    if(e.toElement == overlay){
      overlay.remove()
    }
  }

  var overlay_body = parseHTML(`
    <form class='overlay-form' onsubmit="addProject(this);return false">
      <input type='text' name='name' placeholder='Name' required>
      <input type='text' name='shortname' placeholder='ShortName' required>
      <button style="max-width:300px;" class='btn-round btn__blue'>Add Project</button>
    </form>
  `)
  overlay.appendChild(overlay_body)
  

  document.body.appendChild(overlay)
}


function b64DecodeUnicode(str) {
  // Going backwards: from bytestream, to percent-encoding, to original string.
  return decodeURIComponent(atob(str).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
}

function getPayload(token) {
  return JSON.parse(b64DecodeUnicode(token.split('.')[1]));
}

function parseHTML(html) {
  var t = document.createElement('template');
  t.innerHTML = html;
  return t.content.cloneNode(true);
}


function list_projects(select) {
  console.log(select);
  select.innerHTML = "<option value='' disabled='' selected='' hidden>Project</option>";
    const tickets_QUERY = Apollo.gql`
    query {
      projects{
        shortname
        name
        ID
      }
    }`
    
    
    
    client.query({
      query: tickets_QUERY,
    })
      .then(data => {
          data.data.projects.forEach(project => {
              RenderProject(project)
          });
      })
      .catch(error => console.error(error));
    
    
    function RenderProject(ticket) {
      var list_item = parseHTML(`
        <option value="${ticket.ID}">${ticket.shortname}</option>
      `)
      select.appendChild(list_item)
    }
    
  
}

document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('*[_onload]').forEach(element => {
    evalInContext(element.attributes._onload.value, element)
  });
});


function evalInContext(js, context) {
  //# Return the results of the in-line anonymous function we .call with the passed context
  return function() { return eval(js); }.call(context);
}

function removeA(arr) {
  var what, a = arguments, L = a.length, ax;
  while (L > 1 && arr.length) {
      what = a[--L];
      while ((ax= arr.indexOf(what)) !== -1) {
          arr.splice(ax, 1);
      }
  }
  return arr;
}