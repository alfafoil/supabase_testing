// import { supabase } from "./supabase/createClient"
// import { useState, useEffect } from "react"

import UpdateFollowups from "./components/UpdateFollowups"
import UserInfo from "./pages/UserInfo"

function App() {
  // 1. Hooks MUST be declared inside the component body
  // const [user, setUser] = useState([])

  // async function faitchUserDetails() {
  //   const { data, error } = await supabase.from('Users').select('*')
    
  //   if (error) {
  //     console.error('Error fetching users:', error)
  //     return
  //   }

  //   setUser(data)
  //   console.log("Fetched users:", data) // Log 'data' directly instead of 'user' state
  // }

  // useEffect(() => {
  //   faitchUserDetails()
  // }, [])

  return (
    <>
      {/* <div className="text-red-600">This is the first line.</div>
      
      <pre>{JSON.stringify(user, null, 2)}</pre> */}

      <UserInfo />
      <UpdateFollowups />
    </>
  )
}

export default App