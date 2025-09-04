import GenerateCode from "./GenerateCode"
import NeoShare from "./NeoShare"

const GeneratePage = () => {
    return (
        <div className="generatePage-container">
            <NeoShare />
            <GenerateCode />
        </div>
    )
}

export default GeneratePage