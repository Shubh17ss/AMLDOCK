import './Button.css'

export const AddUserButton=(props)=>{
    return(
        <button className="add-user-button" onClick={props.onClick}>
            + Add User
        </button>
    )
}