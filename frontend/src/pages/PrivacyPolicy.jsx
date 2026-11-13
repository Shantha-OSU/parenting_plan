import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './StaticPage.css';

export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="static-page">
      <div className="static-page__container">
        <Link className="static-page__back" to="/">
          ← Back
        </Link>

        <h1 className="static-page__title">Privacy Policy</h1>
        <p className="static-page__last-updated">
          Effective Date: TBD &nbsp;|&nbsp; Last Revision Date: TBD
        </p>

        <p>
          Your privacy is important to us. To better protect your privacy, we have provided this
          notice explaining our information practices and the choices you can make about the way
          your information is collected and used.
        </p>
        <p>
          Please read this Privacy Policy (also, "Policy") carefully before using this Tool, which
          is provided by Action for Children. The Tool is not legal advice, Action for Children does
          not provide legal advice. If you need legal advice, you should talk to a lawyer. This Tool
          is only meant to be used by parents and adults.
        </p>
        <p>
          Your use of the Tool, including subdomains on which these terms reside (collectively, the
          "Tool"), and the features of this Tool are subject to this Privacy Policy, which we may
          update from time to time.
        </p>

        <h2>About This Policy</h2>
        <p>
          By using this Tool, you agree to the Privacy Policy terms set forth below. This Policy
          does not apply to information we may collect in other ways, like emails. You can see and
          correct any information we have collected by contacting us. Our contact information is
          listed below.
        </p>

        <h2>Information We Collect</h2>
        <p>
          <strong>Contact and account registration information.</strong> To respond to your
          questions or set up an account, we may collect your name and email address. We may also
          collect your address, phone number, username, and password. You may close and delete your
          account at any time. If you delete your account, all form data associated with your
          account will be deleted and your forms will no longer be accessible to you on the Tool.
        </p>
        <p>
          <strong>Personal Information.</strong> We may collect personal information to fill in the
          questions on the Tool. This information may include, but is not limited to, your and your
          child's:
        </p>
        <ul>
          <li>Name</li>
          <li>Date of birth</li>
          <li>Partial social security number</li>
          <li>Monthly income, expenses, and the property you own</li>
          <li>Insurance coverage</li>
          <li>Criminal record</li>
          <li>Arrest history</li>
          <li>Domestic violence history</li>
          <li>Other personal and family history</li>
        </ul>
        <p>
          You can always delete form data. If you delete the data in a form(s), the information
          will no longer be accessible to you through the Tool.
        </p>
        <p>
          <strong>Demographic Information.</strong> We may collect information like zip code,
          gender, income, and age. We may also collect information about race, ethnicity, languages
          spoken, military status, and citizenship status. We may collect information about marital
          status, family size, disability status, child support, and other information.
        </p>
        <p>
          <strong>Location Information.</strong> We may collect information about your location.
          This may include your precise location.
        </p>
        <p>
          <strong>Other Information.</strong> If you use our site, we may collect information about
          the browser you are using. Our web server may store your IP address and domain. We might
          also look at what part of our site you visit. We might also collect information about the
          links you select on our site that take you to third party sites.
        </p>

        <h2>How We Collect Information</h2>
        <p>
          <strong>We collect information directly from you.</strong> For example, we collect
          information when you answer questions. We also collect information if you ask us
          questions, provide feedback, or sign up for emails or texts. We may also collect
          information from third parties.
        </p>
        <p>
          <strong>We collect information from you passively.</strong> We use tracking tools like
          browser cookies. To learn more about these tools and how you can control them, please read
          the "Your Choices" section below.
        </p>

        <h2>How We Use Information</h2>
        <p>We may use your information:</p>
        <ul>
          <li>To process and respond to your questions and requests.</li>
          <li>To create and manage your account.</li>
          <li>
            To create forms and documents. For example, we may share your personal information with
            third-party service providers. These providers may only use your personal information to
            provide us services or follow legal requirements.
          </li>
          <li>To improve our sites and update our email and phone lists.</li>
          <li>
            To communicate with you about our relationship. For example, we might use your contact
            information to tell you about changes to this Policy or our website{' '}
            <button
              className="static-page__back"
              style={{ display: 'inline', margin: 0, fontSize: 'inherit' }}
              onClick={() => navigate('/terms-of-service')}
            >
              Terms of Service
            </button>.
          </li>
          <li>
            For our legitimate business purposes. We may combine information that we receive about
            you from third parties with information we already have. We may also share personal
            information for research, academic studies, data analysis, and reports.
          </li>
          <li>
            For marketing purposes. For example, we might send you information about legal
            developments in which we think you may be interested, about us, our sites, or other
            products or services we offer, or to request your assistance in supporting our
            organization.
          </li>
          <li>As otherwise permitted by law.</li>
        </ul>

        <h2>When We Share Information and Public Records</h2>
        <ul>
          <li>
            <strong>To comply with the law.</strong> For example, we will share information to
            respond to a court order or subpoena. We may also share if a government agency or
            investigatory body requests information.
          </li>
          <li>
            <strong>With third parties performing services on our behalf.</strong> We may share
            information with vendors in the future. We may also authorize them to collect
            information on our behalf. Some suppliers may be outside the United States.
          </li>
          <li>
            <strong>With our business partners.</strong> If we provide joint services, we share
            information with business partners.
          </li>
          <li>In case of change of corporate ownership.</li>
          <li>For other reasons we may describe to you.</li>
        </ul>

        <h2>Your Choices</h2>
        <p>
          You can opt out of receiving marketing emails by following the instructions in any
          marketing emails you receive.
        </p>
        <p>
          By opting into SMS from the Tool or other medium, you are agreeing to receive SMS
          messages from Action for Children. Message frequency varies. Message and data rates may
          apply. SMS consent is not shared with third parties for marketing purposes. Message HELP
          for help. Reply STOP to any message to opt out.
        </p>
        <p>
          You may contact Action for Children to request that we modify, update, or correct your
          personal information. You may also request that we stop contacting you by email. To do
          so, send a detailed request to{' '}
          <a href="mailto:info@actionforchildren.org">info@actionforchildren.org</a>.
        </p>
        <p>
          You can choose not to provide us with some of the information that we request. If you do
          not provide it, we may not be able to fulfill your request. You can also set your browser
          up to reject cookies. If you do this, some features of our sites may not work.
        </p>

        <h2>Where We Store Information</h2>
        <p>
          Our sites are operated in the United States. If you are located outside of the United
          States, please be aware that any information you provide to us may be transferred to the
          United States. By using our sites and giving us your information, you allow this transfer.
          You also understand that the U.S. may not provide the same level of protections as the
          laws of your country.
        </p>

        <h2>Security</h2>
        <p>
          We use standard security measures to protect information submitted. However, the internet
          is public and we cannot promise your information will remain secure. You should use
          caution when deciding what information to put in this Tool.
        </p>
        <p>
          We prioritize the security of your information. Your login credentials, including your
          username and password, are protected using industry-standard encryption through{' '}
          <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noreferrer">
            Google Firebase
          </a>{' '}
          and{' '}
          <a href="https://www.mongodb.com/legal/privacy/privacy-policy" target="_blank" rel="noreferrer">
            MongoDB
          </a>.
        </p>
        <p>
          We retain your data only for as long as you maintain an active account. If you choose to
          delete your account, all associated data will be permanently removed. As long as your
          account remains in use, your data will be stored securely to ensure you can continue to
          access and edit your parenting plans.
        </p>
        <p>
          To ensure your privacy, Action for Children does not have administrative access to your
          personal account, individual answers, or generated documents. Access to your data is
          restricted to you through your unique email login. Any access for administrative purposes
          does not include the right or ability to review, track, or monitor the specific content
          or legal choices you make within the Tool.
        </p>

        <h2>Our Sites and Children</h2>
        <p>
          The Children's Online Privacy Protection Act of 1998 and its rules (collectively,
          "COPPA") require us to inform parents and legal guardians about our practices for
          collecting, using, and disclosing personal information about children under the age of 13
          ("children"). It also requires us to obtain verifiable consent from a child's parent for
          certain collection, use, and disclosure of the child's personal information.
        </p>
        <p>This section notifies parents of:</p>
        <ul>
          <li>The types of information we may collect about children.</li>
          <li>How we use the information we collect.</li>
          <li>Our practices for disclosing that information, including information about third parties.</li>
          <li>
            Our practices for notifying and obtaining parents' consent when we collect personal
            information about children, including how a parent may revoke consent.
          </li>
          <li>All operators that collect or maintain information from children through this Tool.</li>
        </ul>
        <p>
          This section only applies to information about children under the age of 13 and
          supplements the other provisions of this Policy. Children should not be accessing this
          Tool. It is not designed for children. We do not knowingly collect information directly
          from children. We only collect as much information about a child as is reasonably
          necessary, and you should not disclose more personal information than is reasonably
          necessary.
        </p>
        <p>
          <strong>Automatic Information Collection.</strong> We use technology to automatically
          collect information from our users, including information about children, when parents
          access and use the Tool.
        </p>
        <p>
          <strong>Our Practices for Disclosing Children's Information.</strong> We do not share,
          sell, rent, or transfer children's personal information other than as described in this
          section. We may disclose children's personal information:
        </p>
        <ul>
          <li>
            To third parties we use to support our Tool who are bound by contract to use the
            information only for a certain purpose and to keep it confidential.
          </li>
          <li>
            If we are required to do so by law or legal process, such as to follow any court order
            or subpoena or to respond to any government or regulatory request.
          </li>
          <li>
            If we believe disclosure is necessary or appropriate to protect the rights, property,
            or safety of Action for Children, our customers, or others — including to protect the
            safety of a child, protect the security of the Tool, or enable us to take precautions
            against liability.
          </li>
          <li>To law enforcement agencies or for an investigation related to public safety.</li>
          <li>
            If Action for Children is involved in a merger, divestiture, restructuring,
            reorganization, dissolution, or other sale or transfer of assets, we may transfer
            collected personal information to the buyer or other successor.
          </li>
        </ul>
        <p>
          <strong>Accessing and Correcting Your Child's Personal Information.</strong> At any time,
          you may review the personal information we have about your child, require us to correct
          or delete it, and/or refuse to permit us from further collecting or using the child's
          information. To protect your privacy and security, we may require you to take certain
          steps or provide additional information to verify your identity before we provide any
          information or make changes.
        </p>
        <p>
          Our tool is not intended for use by children under 18. If we learn we have
          unintentionally collected personal data from a child under 18 without verification of
          parental consent, we will delete that information. If you are a parent or guardian and
          think we have information about your child, please contact{' '}
          <a href="mailto:info@actionforchildren.org">info@actionforchildren.org</a>.
        </p>
        <p>
          For more on protecting your child online, visit the{' '}
          <a href="https://consumer.ftc.gov/identity-theft-and-online-security/protecting-kids-online" target="_blank" rel="noreferrer">
            FTC's website
          </a>.
        </p>

        <h2>Links</h2>
        <p>
          Our sites contain links to third party sites. If you click on one of those links, you
          will be taken to sites we do not control. This Policy does not apply to those sites.
        </p>

        <h2>Policy Updates</h2>
        <p>
          From time to time we may change our Privacy Policy practices. The latest version of this
          Policy will be posted here. Sometimes there may be a material change to this Policy that
          we wish to apply retroactively. If so, we will notify you and obtain your consent as
          required by law.
        </p>

        <h2>More Questions?</h2>
        <p>
          If you have additional questions you can reach us by email at{' '}
          <a href="mailto:info@actionforchildren.org">info@actionforchildren.org</a>. You can write
          to us at:
        </p>
        <address>
          Action for Children<br />
          105 Schrock Rd, Suite 125<br />
          Columbus, OH 43229
        </address>
        <p>
          Please include your email address, name, address, and telephone number when you contact
          us. This helps us answer you.
        </p>
      </div>
    </div>
  );
}
